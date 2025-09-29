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
  async startRecording(cameraId: string, durationSec: number) {
    const cam = await this.camRepo.findOne({ where: { id: cameraId } });
    if (!cam) throw new NotFoundException('Camera not found');
    // Build RTSP url nếu chưa có sẵn
    const rtsp = cam.rtspUrl || `rtsp://${cam.username}:${cam.password}@${cam.ipAddress}:${cam.rtspPort}`;

  // Tạo đường dẫn output tạm/thư mục cấu hình
  const filename = `${randomUUID()}.mp4`;
    const outPath = join(process.env.RECORD_DIR || tmpdir(), filename);

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

    // 3) Gọi FFmpeg để ghi (ưu tiên tốc độ và độ ổn định)
    const args = [
      '-hide_banner',
      '-rtsp_transport', 'tcp',
      '-stimeout', '10000000', // 10s timeout kết nối
      '-i', rtsp,
      '-t', String(durationSec),
      // copy codec để nhanh và ít CPU nếu camera stream đã là H.264/H.265
      '-c', 'copy',
      // giảm latency buffer
      '-fflags', 'nobuffer',
      '-analyzeduration', '1000000', // 1s
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
