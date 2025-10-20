// RecordingService: Điều khiển tiến trình FFmpeg để ghi video RTSP ra file
// Luồng startRecording:
// 1) Tìm camera -> build RTSP URL
// 2) Tạo bản ghi trạng thái PENDING -> lưu
// 3) spawn ffmpeg với tham số tối ưu -> cập nhật RUNNING
// 4) Khi ffmpeg kết thúc: upload lên R2 (if enabled) -> cập nhật COMPLETED/FAILED và thời gian endedAt
// 5) Có watchdog tự hủy tiến trình nếu vượt quá (duration + 20s)
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { unlink } from 'fs/promises';

import { Recording } from '../../typeorm/entities/recording.entity';
import { Camera } from '../../typeorm/entities/camera.entity';
import { StorageService } from '../storage/storage.service';

// Service điều khiển ghi hình bằng FFmpeg, lưu file local (có thể thay bằng S3)
@Injectable()
export class RecordingService {
  constructor(
    @InjectRepository(Recording) private readonly recRepo: Repository<Recording>,
    @InjectRepository(Camera) private readonly camRepo: Repository<Camera>,
    private readonly storageService: StorageService,
  ) {}

  // Lưu tiến trình đang chạy để có thể STOP
  private active: Map<string, { proc: ReturnType<typeof spawn>; strategy: string; started: number; natural?: boolean; userStop?: boolean; timer?: NodeJS.Timeout }> = new Map();

  // Helper: Upload recording to R2 after FFmpeg completes (if enabled)
  private async uploadRecordingToR2(recId: string, localPath: string, cameraId: string): Promise<string> {
    if (process.env.STORAGE_MODE !== 'r2') {
      return localPath; // Keep local path if R2 disabled
    }

    try {
      const filename = localPath.split(/[\\/]/).pop() || `${Date.now()}.mp4`;
      const r2Key = `recordings/${cameraId}/${Date.now()}-${filename}`;
      const r2Url = await this.storageService.uploadFile(localPath, r2Key);
      
      if (process.env.DEBUG_RECORDING) {
        // eslint-disable-next-line no-console
        console.debug('[RECORDING] Uploaded to R2', { recId, r2Url });
      }

      // Delete temp local file after successful upload
      try {
        await unlink(localPath);
        if (process.env.DEBUG_RECORDING) {
          // eslint-disable-next-line no-console
          console.debug('[RECORDING] Deleted local temp file', { localPath });
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[RECORDING] Failed to delete local temp file', (e as Error).message);
      }

      return r2Url;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[RECORDING] R2 upload failed, keeping local file', (e as Error).message);
      return localPath; // Fallback to local on error
    }
  }

  // Phân loại stderr ffmpeg tương tự snapshot để dễ debug
  private classifyFfmpegError(stderr: string): string {
    const s = stderr.toLowerCase();
    if (/401|unauthorized|auth/i.test(stderr)) return 'AUTH';
    if (/timed? out|stimeout|timeout/.test(s)) return 'TIMEOUT';
    if (/connection refused|no route to host|network is unreachable|unable to connect|connection timed out/.test(s)) return 'CONN';
    if (/404|not found|server returned 404/.test(s)) return 'NOT_FOUND';
    if (/invalid data|could not find codec parameters|moov atom not found|malformed/.test(s)) return 'FORMAT';
    if (/permission denied|access denied/.test(s)) return 'PERMISSION';
    return 'UNKNOWN';
  }

  // Bắt đầu ghi từ camera trong durationSec giây
  async startRecording(cameraId: string, durationSec: number, strategy?: string, filename?: string) {
    const cam = await this.camRepo.findOne({ where: { id: cameraId } });
    if (!cam) throw new NotFoundException('Camera not found');
    const strat = (strategy || 'RTSP').toUpperCase();

    // Tạo tên file (cho phép user override)
    const finalName = filename && filename.trim().length > 0 ? filename.trim() : `${randomUUID()}.mp4`;
    const outPath = join(process.env.RECORD_DIR || tmpdir(), finalName);

    // 2) Lưu bản ghi PENDING (chưa chạy xong)
    // Tạo entity ở trạng thái PENDING và lưu; dùng create() không tham số để chắc chắn kiểu đơn lẻ
    let rec = this.recRepo.create();
    Object.assign(rec, {
      camera: cam,
      storagePath: outPath,
      durationSec,
      startedAt: new Date(),
      status: 'PENDING',
      strategy: strat,
    } as Partial<Recording>);
    rec = await this.recRepo.save(rec);

    if (strat === 'FAKE') {
      const size = (process.env.FAKE_RECORD_SIZE || '1280x720').match(/^\d+x\d+$/) ? process.env.FAKE_RECORD_SIZE! : '1280x720';
      const fr = parseInt(process.env.FAKE_RECORD_FPS || '15', 10);
      const q = process.env.FAKE_RECORD_QUALITY || '23';
      const codec = process.env.FAKE_RECORD_CODEC || 'libx264';
      const filters = [
        `testsrc2=size=${size}:rate=${fr}`,
        `testsrc=size=${size}:rate=${fr}`,
        `color=c=black:s=${size}`,
      ];
      await this.recRepo.update(rec.id, { status: 'RUNNING' } as any);
      const runWithFilter = (idx: number) => {
        const filter = filters[idx];
        const args = [
          '-hide_banner',
          ...(process.env.FAKE_RECORD_REALTIME === '0' ? [] : ['-re']),
          '-f', 'lavfi', '-i', filter,
          '-pix_fmt', 'yuv420p',
          ...(codec ? ['-c:v', codec] : []),
          ...(codec === 'libx264' ? ['-preset', 'veryfast', '-crf', q] : []),
          '-y', outPath,
        ];
        if (process.env.DEBUG_RECORDING) console.debug(`[RECORDING][FAKE] try filter[${idx}]`, filter);
        const child = spawn(ffmpegPath || 'ffmpeg', args, { windowsHide: true });
        const ctx = { proc: child, strategy: 'FAKE', started: Date.now() } as any;
        this.active.set(rec.id, ctx);
        let stderr = '';
        child.stderr?.on('data', d => { stderr += d.toString(); if (process.env.DEBUG_RECORDING) console.debug('[RECORDING][FAKE][stderr]', d.toString().trim()); });
        ctx.timer = setTimeout(() => {
          const a = this.active.get(rec.id);
          if (!a || a.userStop) return;
          a.natural = true;
          try { a.proc.kill('SIGINT'); } catch {}
        }, durationSec * 1000);
        child.on('close', async (code) => {
          const a = this.active.get(rec.id);
            if (a?.userStop) {
              if (a.timer) clearTimeout(a.timer);
              this.active.delete(rec.id);
              return;
            }
            if (a?.timer) clearTimeout(a.timer);
            if (a?.natural) {
              // Upload to R2 if enabled
              const finalPath = await this.uploadRecordingToR2(rec.id, outPath, cameraId);
              await this.recRepo.update(rec.id, { status: 'COMPLETED', endedAt: new Date(), storagePath: finalPath } as any);
              this.active.delete(rec.id);
              return;
            }
            if (code !== 0 && idx < filters.length - 1) {
              runWithFilter(idx + 1);
              return;
            }
            if (code === 0) {
              // Upload to R2 if enabled
              const finalPath = await this.uploadRecordingToR2(rec.id, outPath, cameraId);
              await this.recRepo.update(rec.id, { status: 'COMPLETED', endedAt: new Date(), storagePath: finalPath } as any);
              this.active.delete(rec.id);
              return;
            }
            const reason = this.classifyFfmpegError(stderr);
            const snippet = stderr.replace(/\s+/g, ' ').slice(0, 170);
            await this.recRepo.update(rec.id, { status: 'FAILED', endedAt: new Date(), errorMessage: `FAKE_${reason} ${snippet}` } as any);
            this.active.delete(rec.id);
        });
      };
      runWithFilter(0);
      // Don't expose local temp path - will be R2 URL after completion
      return { id: rec.id, status: 'RUNNING', strategy: 'FAKE' };
    }

    // ---------- RTSP (mặc định) ----------
    const rtsp = cam.rtspUrl || `rtsp://${cam.username}:${cam.password}@${cam.ipAddress}:${cam.rtspPort}`;
    const args = [
      '-hide_banner',
      '-rtsp_transport', 'tcp',
      '-timeout', '10000000',
      '-i', rtsp,
      '-t', String(durationSec),
      '-c', 'copy',
      '-fflags', 'nobuffer',
      '-analyzeduration', '1000000',
      '-probesize', '500000',
      outPath,
    ];

    // Spawn ffmpeg để ghi; stdio ignore để giảm overhead I/O
  const child = spawn(ffmpegPath || 'ffmpeg', args, { windowsHide: true });
  this.active.set(rec.id, { proc: child, strategy: 'RTSP', started: Date.now() });
    let stderr = '';
    child.stderr?.on('data', (d) => {
      const text = d.toString();
      stderr += text;
      if (process.env.DEBUG_RECORDING) {
        // eslint-disable-next-line no-console
        console.debug('[RECORDING][ffmpeg-stderr]', text.trim());
      }
    });
    if (process.env.DEBUG_RECORDING) {
      // eslint-disable-next-line no-console
      console.debug('[RECORDING] spawn ffmpeg', (ffmpegPath || 'ffmpeg'), args.join(' '));
    }
    // Phòng đợi mãi: kill sau (duration + 20s)
    const killer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch {}
    }, (durationSec + 20) * 1000);

  // Cập nhật RUNNING
    await this.recRepo.update(rec.id, { status: 'RUNNING' } as any);

  // 4) Khi xong: cập nhật trạng thái vào DB
    child.on('close', async (code) => {
      clearTimeout(killer);
      if (code === 0) {
        // Upload to R2 if enabled
        const finalPath = await this.uploadRecordingToR2(rec.id, outPath, cameraId);
        await this.recRepo.update(rec.id, { status: 'COMPLETED', endedAt: new Date(), storagePath: finalPath } as any);
        this.active.delete(rec.id);
        return;
      }
      const reason = this.classifyFfmpegError(stderr);
      // Cắt ngắn stderr tránh vượt 255 ký tự (cột error_message)
      const snippet = stderr.replace(/\s+/g, ' ').slice(0, 170); // chừa chỗ cho prefix
      const errorMessage = `FFMPEG_${reason}_code=${code} ${snippet}`.slice(0, 255);
      await this.recRepo.update(rec.id, {
        status: 'FAILED',
        endedAt: new Date(),
        errorMessage,
      } as any);
      if (process.env.DEBUG_RECORDING) {
        // eslint-disable-next-line no-console
        console.error('[RECORDING] failed', { recId: rec.id, reason, code, snippet });
      }
      this.active.delete(rec.id);
    });

    // Don't expose local temp path - will be R2 URL after completion
    return { id: rec.id, status: rec.status, strategy: 'RTSP' };
  }

  // Dừng bản ghi đang chạy
  async stopRecording(id: string) {
    const rec = await this.recRepo.findOne({ where: { id }, relations: ['camera'] });
    if (!rec) throw new NotFoundException('Recording not found');
    if (rec.status !== 'RUNNING') {
      return { id: rec.id, status: rec.status, message: 'NOT_RUNNING' };
    }
    const info = this.active.get(rec.id);
    if (!info) {
      // Không tìm thấy process trong map -> có thể đã kết thúc
      return { id: rec.id, status: rec.status, message: 'NO_ACTIVE_PROCESS' };
    }
    try {
      info.userStop = true; // đánh dấu để close handler không override trạng thái
      if (info.timer) clearTimeout(info.timer);
      if (info.proc) {
        info.proc.kill('SIGINT');
      }
    } catch {}
    
    // Upload to R2 if recording was stopped by user
    const currentPath = rec.storagePath;
    let finalPath = currentPath;
    
    // Wait a bit for FFmpeg to flush and close the file
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
      finalPath = await this.uploadRecordingToR2(rec.id, currentPath, rec.camera.id);
    } catch (e) {
      console.error('[RECORDING] Failed to upload stopped recording to R2', (e as Error).message);
    }
    
    await this.recRepo.update(rec.id, { 
      status: 'STOPPED', 
      endedAt: new Date(), 
      errorMessage: 'STOPPED_BY_USER',
      storagePath: finalPath 
    } as any);
    
    // Xóa map ngay (close handler sẽ thấy userStop và return nếu đến sau)
    this.active.delete(rec.id);
    return { id: rec.id, status: 'STOPPED' };
  }

  // Danh sách recordings (có thể lọc theo camera)
  async listRecordings(cameraId?: string) {
    const recordings = cameraId 
      ? await this.recRepo.find({ where: { camera: { id: cameraId } }, relations: ['camera'] })
      : await this.recRepo.find({ relations: ['camera'] });
    
    // Transform response: hide local temp paths
    return recordings.map(rec => {
      const response: any = { ...rec };
      
      // If FAILED/PENDING/RUNNING and storagePath is local, don't expose it
      if (['FAILED', 'PENDING', 'RUNNING'].includes(rec.status)) {
        if (rec.storagePath && !this.storageService.isR2Url(rec.storagePath)) {
          delete response.storagePath;
        }
      }
      
      return response;
    });
  }

  // Lọc nâng cao: cameraId + status + from/to (ISO) áp dụng startedAt/endedAt giao thoa
  async listRecordingsFiltered(opts: { cameraId?: string; status?: string; from?: string; to?: string }) {
    const qb = this.recRepo.createQueryBuilder('r')
      .leftJoinAndSelect('r.camera', 'c')
      .orderBy('r.startedAt', 'DESC');
    if (opts.cameraId) qb.andWhere('c.id = :cid', { cid: opts.cameraId });
    if (opts.status) qb.andWhere('r.status = :status', { status: opts.status.toUpperCase() });
    if (opts.from) qb.andWhere('r.startedAt >= :from', { from: new Date(opts.from) });
    if (opts.to) qb.andWhere('r.startedAt <= :to', { to: new Date(opts.to) });
    const recordings = await qb.getMany();
    
    // Transform response: hide local temp paths
    return recordings.map(rec => {
      const response: any = { ...rec };
      
      // If FAILED/PENDING/RUNNING and storagePath is local, don't expose it
      if (['FAILED', 'PENDING', 'RUNNING'].includes(rec.status)) {
        if (rec.storagePath && !this.storageService.isR2Url(rec.storagePath)) {
          delete response.storagePath;
        }
      }
      
      return response;
    });
  }

  // Chi tiết bản ghi
  async getRecording(id: string) {
    const rec = await this.recRepo.findOne({ where: { id }, relations: ['camera'] });
    if (!rec) throw new NotFoundException('Recording not found');
    
    // Transform response: hide local temp path, only show R2 URL if available
    const response: any = { ...rec };
    
    // If FAILED/PENDING/RUNNING and storagePath is local, don't expose it
    if (['FAILED', 'PENDING', 'RUNNING'].includes(rec.status)) {
      if (rec.storagePath && !this.storageService.isR2Url(rec.storagePath)) {
        delete response.storagePath;
      }
    }
    
    // If COMPLETED/STOPPED, storagePath should already be R2 URL
    // (set by uploadRecordingToR2 in close handler)
    
    return response;
  }
}
