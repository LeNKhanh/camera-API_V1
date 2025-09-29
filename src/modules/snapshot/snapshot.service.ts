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
    // Xây dựng danh sách ứng viên RTSP. Nếu đã có cam.rtspUrl thì chỉ cần một phần tử.
    let rtspCandidates: string[] = [];
    if (cam.rtspUrl?.trim()) {
      rtspCandidates = [cam.rtspUrl.trim()];
    } else {
      if (!cam.username || !cam.password) {
        throw new Error('Camera missing rtspUrl or username/password to build RTSP URL');
      }
      const baseAuth = `${encodeURIComponent(cam.username)}:${encodeURIComponent(cam.password)}@${cam.ipAddress}:${cam.rtspPort}`;
      const vendor = (cam.vendor || '').toLowerCase();
      if (vendor.includes('hik')) {
        rtspCandidates.push(
          `rtsp://${baseAuth}/Streaming/Channels/101`,
          `rtsp://${baseAuth}/Streaming/Channels/102`,
        );
      } else if (vendor.includes('dahua')) {
        rtspCandidates.push(
          `rtsp://${baseAuth}/cam/realmonitor?channel=1&subtype=0`,
          `rtsp://${baseAuth}/cam/realmonitor?channel=1&subtype=1`,
        );
      } else if (vendor.includes('onvif')) {
        rtspCandidates.push(`rtsp://${baseAuth}/onvif-media/media.amp`);
      }
      // Fallback chung
      rtspCandidates.push(
        `rtsp://${baseAuth}/live`,
        `rtsp://${baseAuth}/`,
      );
      if (process.env.DEBUG_SNAPSHOT) {
        // eslint-disable-next-line no-console
        console.debug('[SNAPSHOT] rtsp candidate list', rtspCandidates);
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
    const buildArgs = (url: string, transport: 'tcp' | 'udp', includeStimeout = true) => {
      const arr = [
        '-loglevel', 'error',
        '-hide_banner',
        '-rtsp_transport', transport,
        ...(transport === 'tcp' ? ['-rtsp_flags', 'prefer_tcp'] : []),
        // -stimeout là microseconds, convert từ ms
        ...(includeStimeout ? ['-stimeout', String(timeoutMs * 1000)] : []),
        '-analyzeduration', analyzeduration,
        '-probesize', probesize,
        '-i', url,
        '-frames:v', '1',
        '-q:v', '2',
        '-y',
        outPath,
      ];
      return arr;
    };
  const attemptOne = async (url: string): Promise<{ ok: boolean; error?: string; reason?: string; usedUrl?: string; }> => {
      const args = buildArgs(url, 'tcp', true);
      if (process.env.DEBUG_SNAPSHOT) {
        // eslint-disable-next-line no-console
        console.debug('[SNAPSHOT] attempt tcp', (ffmpegPath || 'ffmpeg'), args.join(' '));
      }
      let lastErr: unknown;
      try {
        await runOnce(args);
        return { ok: true, usedUrl: url };
      } catch (e) {
        const msg = (e as Error).message || '';
        // Retry bỏ -stimeout nếu unsupported
        if (/Unrecognized option 'stimeout'/i.test(msg)) {
          if (process.env.DEBUG_SNAPSHOT) console.debug('[SNAPSHOT] retry no -stimeout');
          try { await runOnce(buildArgs(url, 'tcp', false)); return { ok: true, usedUrl: url }; } catch (e2) { lastErr = e2; }
        } else {
          lastErr = e;
        }
        // UDP fallback
        if (lastErr && process.env.SNAPSHOT_FALLBACK_UDP === '1') {
          if (process.env.DEBUG_SNAPSHOT) console.debug('[SNAPSHOT] retry udp fallback');
            try { await runOnce(buildArgs(url, 'udp', true)); return { ok: true, usedUrl: url }; } catch (e3) { lastErr = e3; }
        }
      }
      const errMsg = (lastErr as Error)?.message || String(lastErr);
      return { ok: false, error: errMsg, reason: this.classifyFfmpegError(errMsg), usedUrl: url };
    };
	const runOnce = (runArgs: string[]) => new Promise<void>((resolve, reject) => {
      const hardLimitMs = parseInt(process.env.SNAPSHOT_HARD_TIMEOUT_MS || '15000', 10); // 15s watchdog
      const child = spawn(ffmpegPath || 'ffmpeg', runArgs, { windowsHide: true });
      let stderr = '';
      const timer = setTimeout(() => {
        try { child.kill('SIGKILL'); } catch { /* ignore */ }
        reject(new Error(`FFmpeg watchdog timeout after ${hardLimitMs}ms. Partial stderr: ${stderr.slice(0,400)}`));
      }, hardLimitMs);
      child.stderr.on('data', d => { stderr += d.toString(); });
      child.on('error', err => { clearTimeout(timer); reject(err); });
      child.on('close', (code) => {
        clearTimeout(timer);
        if (process.env.DEBUG_SNAPSHOT && stderr) {
          // eslint-disable-next-line no-console
          console.debug('[SNAPSHOT] ffmpeg stderr snippet', stderr.substring(0, 800));
        }
        if (code === 0) return resolve();
        reject(new Error(`FFmpeg failed (code=${code}) ${stderr.trim()}`));
      });
    });
    const attempts: { url: string; error?: string; reason?: string }[] = [];
    let successUrl: string | undefined;
    for (const candidate of rtspCandidates) {
      const res = await attemptOne(candidate);
      if (res.ok) { successUrl = res.usedUrl; break; }
      attempts.push({ url: candidate.replace(/:\/\/[\w%.-]+:[^@]+@/, '://***:***@'), error: res.error, reason: res.reason });
    }
    if (!successUrl) {
      // eslint-disable-next-line no-console
      console.error('[SNAPSHOT] all candidates failed', { cameraId, attempts });
      const summary = attempts.map(a => `${a.reason}:${a.url}`).join('; ');
      throw new InternalServerErrorException(`SNAPSHOT_CAPTURE_FAILED:ALL_CANDIDATES_FAILED ${summary}`);
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
