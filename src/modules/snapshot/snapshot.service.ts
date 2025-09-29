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
    // Ưu tiên rtspUrl đã cấu hình; nếu không, tự xây dựng thử theo vendor phổ biến.
    let rtsp = cam.rtspUrl?.trim();
    if (!rtsp) {
      if (!cam.username || !cam.password) {
        throw new Error('Camera missing rtspUrl or username/password to build RTSP URL');
      }
      const baseAuth = `${encodeURIComponent(cam.username)}:${encodeURIComponent(cam.password)}@${cam.ipAddress}:${cam.rtspPort}`;
      // Các pattern phổ biến (có thể tuỳ biến sau này). Thứ tự quan trọng.
      const vendor = (cam.vendor || '').toLowerCase();
      const candidates: string[] = [];
      if (vendor.includes('hik') || vendor.includes('hikvision')) {
        candidates.push(`rtsp://${baseAuth}/Streaming/Channels/101`); // Main stream
        candidates.push(`rtsp://${baseAuth}/Streaming/Channels/102`); // Sub stream
      } else if (vendor.includes('dahua')) {
        candidates.push(`rtsp://${baseAuth}/cam/realmonitor?channel=1&subtype=0`);
        candidates.push(`rtsp://${baseAuth}/cam/realmonitor?channel=1&subtype=1`);
      } else if (vendor.includes('onvif')) {
        candidates.push(`rtsp://${baseAuth}/onvif-media/media.amp`);
      }
      // Generic fallback nếu không match vendor
      candidates.push(`rtsp://${baseAuth}/live`);
      candidates.push(`rtsp://${baseAuth}/`);
      // Chọn candidate đầu (chúng ta không biết chính xác đường dẫn thực tế). Có thể thử lần lượt tương lai.
      rtsp = candidates[0];
      if (process.env.DEBUG_SNAPSHOT) {
        // eslint-disable-next-line no-console
        console.debug('[SNAPSHOT] built RTSP from vendor patterns', { chosen: rtsp, candidates });
      }
    }

    const outName = filename || `${randomUUID()}.jpg`;
    const baseDir = process.env.SNAPSHOT_DIR || tmpdir();
    if (!existsSync(baseDir)) {
      try { mkdirSync(baseDir, { recursive: true }); } catch (e) { throw new Error(`Cannot create snapshot dir ${baseDir}: ${(e as any).message}`); }
    }
    const outPath = join(baseDir, outName);

    // Tối ưu tham số giúp vào stream nhanh hơn và tránh treo lâu
    // ffmpeg -i <rtsp> -frames:v 1 -q:v 2 out.jpg
    const timeoutMs = parseInt(process.env.SNAPSHOT_TIMEOUT_MS || '10000', 10); // 10s default
    const analyzeduration = process.env.SNAPSHOT_ANALYZE_US || '500000';
    const probesize = process.env.SNAPSHOT_PROBESIZE || '500000';

    // Xây dựng args FFmpeg. Một số bản build cũ không hỗ trợ -stimeout (thấy lỗi Unrecognized option 'stimeout')
    // Ta thêm rồi nếu fail vì option này sẽ retry không có nó.
    const buildArgs = (transport: 'tcp' | 'udp', includeStimeout = true) => {
      const arr = [
        '-loglevel', 'error',
        '-hide_banner',
        '-rtsp_transport', transport,
        ...(transport === 'tcp' ? ['-rtsp_flags', 'prefer_tcp'] : []),
        // -stimeout là microseconds, convert từ ms
        ...(includeStimeout ? ['-stimeout', String(timeoutMs * 1000)] : []),
        '-analyzeduration', analyzeduration,
        '-probesize', probesize,
        '-i', rtsp,
        '-frames:v', '1',
        '-q:v', '2',
        '-y',
        outPath,
      ];
      return arr;
    };
  const args = buildArgs('tcp', true);
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
      const msg = (e as Error).message || '';
      // Nếu lỗi do -stimeout không hỗ trợ thì thử lại bỏ flag đó.
      if (/Unrecognized option 'stimeout'/i.test(msg)) {
        if (process.env.DEBUG_SNAPSHOT) {
          // eslint-disable-next-line no-console
          console.debug('[SNAPSHOT] retry without -stimeout (unsupported in this ffmpeg build)');
        }
        try {
          await runOnce(buildArgs('tcp', false));
          lastErr = undefined;
        } catch (e2) {
          lastErr = e2;
        }
      } else {
        lastErr = e;
      }

      // UDP fallback nếu vẫn còn lỗi và bật cấu hình
      if (lastErr && process.env.SNAPSHOT_FALLBACK_UDP === '1') {
        const udpArgs = buildArgs('udp', !( /Unrecognized option 'stimeout'/i.test(msg)) );
        if (process.env.DEBUG_SNAPSHOT) {
          // eslint-disable-next-line no-console
          console.debug('[SNAPSHOT] retry udp fallback', (ffmpegPath || 'ffmpeg'), udpArgs.join(' '));
        }
        try { await runOnce(udpArgs); lastErr = undefined; } catch (e3) { lastErr = e3; }
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

    const snap = this.snapRepo.create({ camera: cam, storagePath: outPath, } as any);
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
