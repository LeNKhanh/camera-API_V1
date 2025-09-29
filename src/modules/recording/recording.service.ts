// RecordingService: Điều khiển tiến trình FFmpeg để ghi video RTSP ra file
// Luồng startRecording:
// 1) Tìm camera -> build RTSP URL
// 2) Tạo bản ghi trạng thái PENDING -> lưu
// 3) spawn ffmpeg với tham số tối ưu -> cập nhật RUNNING
// 4) Khi ffmpeg kết thúc: cập nhật COMPLETED/FAILED và thời gian endedAt
// 5) Có watchdog tự hủy tiến trình nếu vượt quá (duration + 20s)
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';

import { Recording } from '../../typeorm/entities/recording.entity';
import { Camera } from '../../typeorm/entities/camera.entity';

// Service điều khiển ghi hình bằng FFmpeg, lưu file local (có thể thay bằng S3)
@Injectable()
export class RecordingService {
  constructor(
    @InjectRepository(Recording) private readonly recRepo: Repository<Recording>,
    @InjectRepository(Camera) private readonly camRepo: Repository<Camera>,
  ) {}

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
    } as Partial<Recording>);
    rec = await this.recRepo.save(rec);

    // Chiến lược FAKE: tạo video synthetic (testsrc) để test khi không có camera thật
    if (strat === 'FAKE') {
      const size = (process.env.FAKE_RECORD_SIZE || '1280x720').match(/^\d+x\d+$/) ? process.env.FAKE_RECORD_SIZE! : '1280x720';
      const fr = parseInt(process.env.FAKE_RECORD_FPS || '15', 10);
      const q = process.env.FAKE_RECORD_QUALITY || '23'; // CRF cho libx264 (nếu tái mã hoá)
      const codec = process.env.FAKE_RECORD_CODEC || 'libx264';
      // testsrc2 -> testsrc -> color loop
      const candidateFilters = [
        `testsrc2=duration=${durationSec}:size=${size}:rate=${fr}`,
        `testsrc=duration=${durationSec}:size=${size}:rate=${fr}`,
        `color=c=black:s=${size}:d=${durationSec}`,
      ];
      let chosenFilter: string | null = null; let lastErr: any;
      for (const f of candidateFilters) {
        // Thử nhanh xem ffmpeg có chấp nhận filter không bằng cách chuẩn bị spawn (ở đây cứ chọn filter đầu hoạt động – nếu fail sẽ tiếp tục)
        chosenFilter = f; // ta cứ gán, nếu fail ở run thật sẽ thử cái tiếp theo
        try {
          await new Promise<void>((resolve, reject) => {
            const testArgs = ['-v', 'error', '-f', 'lavfi', '-i', f, '-t', '0.1', '-f', 'null', '-'];
            const proc = spawn(ffmpegPath || 'ffmpeg', testArgs, { windowsHide: true });
            let errb = '';
            proc.stderr?.on('data', d => errb += d.toString());
            proc.on('close', c => c === 0 ? resolve() : reject(new Error(errb)));
            proc.on('error', reject);
          });
          break; // thành công
        } catch (e) { lastErr = e; chosenFilter = null; }
      }
      if (!chosenFilter) {
        await this.recRepo.update(rec.id, { status: 'FAILED', endedAt: new Date(), errorMessage: 'FAKE_FILTER_FAILED' } as any);
        return { id: rec.id, storagePath: rec.storagePath, status: 'FAILED' };
      }
      const args = [
        '-hide_banner',
        '-f', 'lavfi',
        '-i', chosenFilter,
        '-t', String(durationSec),
        '-pix_fmt', 'yuv420p',
        ...(codec ? ['-c:v', codec] : []),
        ...(codec === 'libx264' ? ['-preset', 'veryfast', '-crf', q] : []),
        '-y',
        outPath,
      ];
      if (process.env.DEBUG_RECORDING) console.debug('[RECORDING][FAKE] args', args.join(' '));
      const child = spawn(ffmpegPath || 'ffmpeg', args, { windowsHide: true });
      let stderr = '';
      child.stderr?.on('data', d => { stderr += d.toString(); if (process.env.DEBUG_RECORDING) console.debug('[RECORDING][FAKE][stderr]', d.toString().trim()); });
      child.on('close', async (code) => {
        if (code === 0) {
          await this.recRepo.update(rec.id, { status: 'COMPLETED', endedAt: new Date() } as any);
        } else {
          const reason = this.classifyFfmpegError(stderr);
            const snippet = stderr.replace(/\s+/g, ' ').slice(0, 170);
          await this.recRepo.update(rec.id, { status: 'FAILED', endedAt: new Date(), errorMessage: `FAKE_${reason} ${snippet}` } as any);
        }
      });
      return { id: rec.id, storagePath: rec.storagePath, status: rec.status };
    }

    // ---------- RTSP (mặc định) ----------
    const rtsp = cam.rtspUrl || `rtsp://${cam.username}:${cam.password}@${cam.ipAddress}:${cam.rtspPort}`;
    const args = [
      '-hide_banner',
      '-rtsp_transport', 'tcp',
      '-stimeout', '10000000',
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
        await this.recRepo.update(rec.id, { status: 'COMPLETED', endedAt: new Date() } as any);
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
    });

    return { id: rec.id, storagePath: rec.storagePath, status: rec.status };
  }

  // Danh sách recordings (có thể lọc theo camera)
  listRecordings(cameraId?: string) {
    if (cameraId) return this.recRepo.find({ where: { camera: { id: cameraId } }, relations: ['camera'] });
    return this.recRepo.find({ relations: ['camera'] });
  }

  // Chi tiết bản ghi
  async getRecording(id: string) {
    const rec = await this.recRepo.findOne({ where: { id }, relations: ['camera'] });
    if (!rec) throw new NotFoundException('Recording not found');
    return rec;
  }
}
