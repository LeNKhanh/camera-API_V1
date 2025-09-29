// SnapshotService: Chụp ảnh (frame) từ RTSP bằng FFmpeg
// Luồng capture:
// 1) Tìm camera -> build RTSP URL
// 2) Tạo tên file đầu ra -> spawn ffmpeg lấy 1 frame nhanh
// 3) Lưu bản ghi Snapshot vào DB và trả về
import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';

import { Camera } from '../../typeorm/entities/camera.entity';
import { Snapshot } from '../../typeorm/entities/snapshot.entity';

// Service chụp ảnh từ RTSP bằng FFmpeg (lấy frame đầu tiên)
@Injectable()
export class SnapshotService {
  constructor(
    @InjectRepository(Camera) private readonly camRepo: Repository<Camera>,
    @InjectRepository(Snapshot) private readonly snapRepo: Repository<Snapshot>,
  ) {}

  // Phân loại lỗi FFmpeg để client đọc dễ hơn
  // Các mã: AUTH, TIMEOUT, CONN, NOT_FOUND, FORMAT, PERMISSION, UNKNOWN
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

  async capture(cameraId: string, filename?: string) {
    const cam = await this.camRepo.findOne({ where: { id: cameraId } });
    if (!cam) throw new NotFoundException('Camera not found');
    // Ưu tiên rtspUrl đã cấu hình; nếu không, build từ thông tin camera
    if (!cam.rtspUrl && (!cam.username || !cam.password)) {
      throw new Error('Camera missing rtspUrl or username/password to build RTSP URL');
    }
    const rtsp = cam.rtspUrl || `rtsp://${cam.username}:${cam.password}@${cam.ipAddress}:${cam.rtspPort}`;

    const outName = filename || `${randomUUID()}.jpg`;
    const baseDir = process.env.SNAPSHOT_DIR || tmpdir();
    if (!existsSync(baseDir)) {
      try { mkdirSync(baseDir, { recursive: true }); } catch (e) { throw new Error(`Cannot create snapshot dir ${baseDir}: ${(e as any).message}`); }
    }
    const outPath = join(baseDir, outName);

    // Tối ưu tham số giúp vào stream nhanh hơn và tránh treo lâu
    // ffmpeg -i <rtsp> -frames:v 1 -q:v 2 out.jpg
    const buildArgs = (transport: 'tcp' | 'udp') => [
      '-loglevel', 'error',
      '-hide_banner',
      '-rtsp_transport', transport,
      ...(transport === 'tcp' ? ['-rtsp_flags', 'prefer_tcp'] : []),
      '-stimeout', '10000000', // 10s microseconds unit for network timeout
      '-analyzeduration', '500000',
      '-probesize', '500000',
      '-i', rtsp,
      '-frames:v', '1',
      '-q:v', '2',
      '-y', // overwrite if exists
      outPath,
    ];
    const args = buildArgs('tcp');
    const runOnce = (runArgs: string[]) => new Promise<void>((resolve, reject) => {
      const child = spawn(ffmpegPath || 'ffmpeg', runArgs, { windowsHide: true });
      let stderr = '';
      child.stderr.on('data', d => { stderr += d.toString(); });
      child.on('error', err => reject(err));
      child.on('close', (code) => {
        if (code === 0) return resolve();
        reject(new Error(`FFmpeg failed (code=${code}) ${stderr.trim()}`));
      });
    });

    if (process.env.DEBUG_SNAPSHOT) {
      // eslint-disable-next-line no-console
      console.debug('[SNAPSHOT] attempt tcp', (ffmpegPath || 'ffmpeg'), args.join(' '));
    }

    let lastErr: unknown;
    try {
      await runOnce(args);
    } catch (e) {
      lastErr = e;
      const enableUdp = process.env.SNAPSHOT_FALLBACK_UDP === '1';
      if (enableUdp) {
        const udpArgs = buildArgs('udp');
        if (process.env.DEBUG_SNAPSHOT) {
          // eslint-disable-next-line no-console
          console.debug('[SNAPSHOT] retry udp', (ffmpegPath || 'ffmpeg'), udpArgs.join(' '));
        }
        try {
          await runOnce(udpArgs);
          lastErr = undefined; // succeeded on fallback
        } catch (e2) {
          lastErr = e2;
        }
      }
    }
    if (lastErr) {
      const msg = (lastErr as Error).message || String(lastErr);
      const reason = this.classifyFfmpegError(msg);
      // Mask credential in RTSP when logging
      const masked = rtsp.replace(/:\/\/[\w%.-]+:[^@]+@/, '://***:***@');
      // eslint-disable-next-line no-console
      console.error('[SNAPSHOT] capture failed', { cameraId, rtsp: masked, reason, error: msg });
      throw new InternalServerErrorException(`SNAPSHOT_CAPTURE_FAILED:${reason}: ${msg}`);
    }

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
