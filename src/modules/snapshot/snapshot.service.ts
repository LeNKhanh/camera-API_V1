// SnapshotService: Chụp ảnh (frame) từ RTSP bằng FFmpeg
// Luồng capture:
// 1) Tìm camera -> build RTSP URL
// 2) Tạo tên file đầu ra -> spawn ffmpeg lấy 1 frame nhanh
// 3) Lưu bản ghi Snapshot vào DB và trả về
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

import { Camera } from '../../typeorm/entities/camera.entity';
import { Snapshot } from '../../typeorm/entities/snapshot.entity';

// Service chụp ảnh từ RTSP bằng FFmpeg (lấy frame đầu tiên)
@Injectable()
export class SnapshotService {
  constructor(
    @InjectRepository(Camera) private readonly camRepo: Repository<Camera>,
    @InjectRepository(Snapshot) private readonly snapRepo: Repository<Snapshot>,
  ) {}

  async capture(cameraId: string, filename?: string) {
    const cam = await this.camRepo.findOne({ where: { id: cameraId } });
    if (!cam) throw new NotFoundException('Camera not found');
    // Ưu tiên rtspUrl đã cấu hình; nếu không, build từ thông tin camera
    const rtsp = cam.rtspUrl || `rtsp://${cam.username}:${cam.password}@${cam.ipAddress}:${cam.rtspPort}`;

    const outName = filename || `${randomUUID()}.jpg`;
    const outPath = join(process.env.SNAPSHOT_DIR || tmpdir(), outName);

    // Tối ưu tham số giúp vào stream nhanh hơn và tránh treo lâu
    // ffmpeg -i <rtsp> -frames:v 1 -q:v 2 out.jpg
    const args = [
      '-hide_banner',
      '-rtsp_transport', 'tcp',
      '-stimeout', '8000000', // 8s
      '-i', rtsp,
      '-frames:v', '1',
      '-q:v', '2',
      '-analyzeduration', '1000000',
      '-probesize', '500000',
      outPath,
    ];
    await new Promise<void>((resolve, reject) => {
      const child = spawn(ffmpegPath || 'ffmpeg', args);
      child.on('error', reject);
      child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}`))));
    });

    const snap = this.snapRepo.create({ camera: cam, storagePath: outPath } as any);
    await this.snapRepo.save(snap);
    return snap;
  }

  list(cameraId?: string) {
    if (cameraId) return this.snapRepo.find({ where: { camera: { id: cameraId } }, relations: ['camera'] });
    return this.snapRepo.find({ relations: ['camera'] });
  }

  async get(id: string) {
    const snap = await this.snapRepo.findOne({ where: { id }, relations: ['camera'] });
    if (!snap) throw new NotFoundException('Snapshot not found');
    return snap;
  }
}
