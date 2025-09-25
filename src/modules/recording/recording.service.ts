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
    const child = spawn(ffmpegPath || 'ffmpeg', args, { stdio: 'ignore' });
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
      } else {
        await this.recRepo.update(rec.id, {
          status: 'FAILED',
          endedAt: new Date(),
          errorMessage: `ffmpeg exit code ${code}`,
        } as any);
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
