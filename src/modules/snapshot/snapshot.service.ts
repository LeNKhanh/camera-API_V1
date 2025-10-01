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
import { unlink } from 'fs/promises';

import { Camera } from '../../typeorm/entities/camera.entity';
import { Snapshot } from '../../typeorm/entities/snapshot.entity';

// Service chụp ảnh từ RTSP bằng FFmpeg (lấy frame đầu tiên)
@Injectable()
export class SnapshotService {
  constructor(
    @InjectRepository(Camera) private readonly camRepo: Repository<Camera>,
    @InjectRepository(Snapshot) private readonly snapRepo: Repository<Snapshot>,
  ) {}

  // Ghi nhớ xem ffmpeg build hiện tại có hỗ trợ -stimeout hay không (null = chưa kiểm tra)
  private stimeoutSupported: boolean | null = null;

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

  async capture(
    cameraId: string,
    filename?: string,
    overrideRtsp?: string,
    strategy: string = 'RTSP',
  ) {
    const cam = await this.camRepo.findOne({ where: { id: cameraId } });
    if (!cam) throw new NotFoundException('Camera not found');

    // Placeholder triển khai theo flow SDK người dùng gửi (CLIENT_Init -> Login -> Snap -> Logout -> Cleanup)
    // Hiện tại chưa tích hợp native SDK. Nếu bật STRATEGY SDK nhưng chưa enable thì trả lỗi rõ.
    const strat = (strategy || 'RTSP').toUpperCase();

    // FAKE: tạo ảnh testsynthetic (không cần RTSP) để bạn thử API khi chưa có camera thật
    if (strat === 'FAKE') {
      const outName = filename || `${randomUUID()}.jpg`;
      const baseDir = process.env.SNAPSHOT_DIR || tmpdir();
      if (!existsSync(baseDir)) {
        try { mkdirSync(baseDir, { recursive: true }); } catch (e) { throw new Error(`Cannot create snapshot dir ${baseDir}: ${(e as any).message}`); }
      }
      const outPath = join(baseDir, outName);
      // Xử lý size an toàn: nếu biến env undefined / rỗng / sai pattern -> fallback 1280x720
      const requestedSize = process.env.FAKE_SNAPSHOT_SIZE;
      const size = (requestedSize && /^\d+x\d+$/.test(requestedSize)) ? requestedSize : '1280x720';
      const quality = process.env.FAKE_SNAPSHOT_QUALITY || '2'; // 2 = khá rõ, 31 = mờ
      const bg = process.env.FAKE_SNAPSHOT_BG || 'black';

      const runFfmpeg = (filter: string) => new Promise<void>((resolve, reject) => {
        const args = [
          '-loglevel', 'error',
          '-f', 'lavfi',
          '-i', filter,
          '-frames:v', '1',
          '-q:v', quality,
          '-y',
          outPath,
        ];
        if (process.env.DEBUG_SNAPSHOT) {
          // eslint-disable-next-line no-console
          console.debug('[SNAPSHOT][FAKE] spawn ffmpeg', (ffmpegPath || 'ffmpeg'), args.join(' '));
        }
        const child = spawn(ffmpegPath || 'ffmpeg', args, { windowsHide: true });
        let stderr = '';
        child.stderr.on('data', d => { stderr += d.toString(); });
        child.on('error', err => reject(err));
        child.on('close', code => {
          if (code === 0) return resolve();
          reject(new Error(`code=${code} ${stderr.trim()}`));
        });
      });

      // Thử lần lượt: testsrc2 -> testsrc -> color (fallback tối thiểu)
      let fakeOk = false; let lastErr: any;
      for (const filter of [
        `testsrc2=size=${size}:rate=1`,
        `testsrc=size=${size}:rate=1`,
        `color=c=${bg}:s=${size}:d=0.01`,
      ]) {
        try { await runFfmpeg(filter); fakeOk = true; break; } catch (e) { lastErr = e; }
      }
      if (!fakeOk) {
        throw new InternalServerErrorException(`SNAPSHOT_FAKE_FAILED: ${(lastErr as Error).message}`);
      }
      const snap = this.snapRepo.create({ camera: cam, storagePath: outPath } as any);
      await this.snapRepo.save(snap);
      if (process.env.DEBUG_SNAPSHOT) {
        // eslint-disable-next-line no-console
        console.debug('[SNAPSHOT] FAKE strategy snapshot created', { cameraId: cam.id, path: outPath });
      }
      return snap;
    }
    if (strat === 'SDK_NETWORK' || strat === 'SDK_LOCAL') {
      if (process.env.ENABLE_SDK_SNAPSHOT !== '1') {
        throw new InternalServerErrorException('SDK_SNAPSHOT_DISABLED: bật ENABLE_SDK_SNAPSHOT=1 để dùng strategy SDK');
      }
      // Giả lập từng bước và sau đó fallback qua RTSP nếu không có addon
      if (process.env.DEBUG_SNAPSHOT) {
        // eslint-disable-next-line no-console
        console.debug(`[SDK_SNAPSHOT] strategy=${strat} steps: INIT -> LOGIN -> ${strat === 'SDK_NETWORK' ? 'SnapPictureToFile' : 'RealPlay + CapturePictureEx'} -> LOGOUT -> CLEANUP (mock)`);
      }
      // Future: integrate native addon here.
      // Tạm thời: continue to RTSP fallback dưới để vẫn chụp nếu có stream.
    }
    // Xây dựng danh sách ứng viên RTSP. Nếu đã có cam.rtspUrl thì chỉ cần một phần tử.
    let rtspCandidates: string[] = [];
    if (overrideRtsp?.trim()) {
      rtspCandidates = [overrideRtsp.trim()];
    } else if (cam.rtspUrl?.trim()) {
      rtspCandidates = [cam.rtspUrl.trim()];
    } else {
      if (!cam.username || !cam.password) {
        throw new Error('Camera missing rtspUrl or username/password to build RTSP URL');
      }
      const altPorts = (process.env.ALT_RTSP_PORTS || '')
        .split(',')
        .map(p => p.trim())
        .filter(p => /^\d+$/.test(p) && p !== String(cam.rtspPort));
      const basePortList = [String(cam.rtspPort), ...altPorts];
      // Generate baseAuth variants for each port
      const baseAuthPorts = basePortList.map(port => `${encodeURIComponent(cam.username!)}:${encodeURIComponent(cam.password!)}@${cam.ipAddress}:${port}`);
      for (const auth of baseAuthPorts) {
        rtspCandidates.push(
          `rtsp://${auth}/cam/realmonitor?channel=1&subtype=0`,
          `rtsp://${auth}/cam/realmonitor?channel=1&subtype=1`,
          `rtsp://${auth}/cam/realmonitor?channel=1&subtype=2`,
        );
        rtspCandidates.push(`rtsp://${auth}/live`, `rtsp://${auth}/`);
      }
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
      // Nếu đã phát hiện không hỗ trợ thì ép includeStimeout=false
      if (this.stimeoutSupported === false) includeStimeout = false;
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
          if (this.stimeoutSupported !== false) {
            this.stimeoutSupported = false; // lưu lại để lần sau không thêm nữa
          }
          if (process.env.DEBUG_SNAPSHOT) console.debug('[SNAPSHOT] retry no -stimeout');
          try { await runOnce(buildArgs(url, 'tcp', false)); return { ok: true, usedUrl: url }; } catch (e2) { lastErr = e2; }
        } else {
          lastErr = e;
        }
        // UDP fallback
        if (lastErr && process.env.SNAPSHOT_FALLBACK_UDP === '1') {
          if (process.env.DEBUG_SNAPSHOT) console.debug('[SNAPSHOT] retry udp fallback');
            try { await runOnce(buildArgs(url, 'udp', true)); return { ok: true, usedUrl: url }; } catch (e3) {
              // Nếu tiếp tục báo unrecognized -stimeout (trường hợp chưa kịp set), set cờ và thử lại lần cuối không có -stimeout
              if (/Unrecognized option 'stimeout'/i.test((e3 as Error).message || '')) {
                this.stimeoutSupported = false;
                try { await runOnce(buildArgs(url, 'udp', false)); return { ok: true, usedUrl: url }; } catch (e4) { lastErr = e4; }
              } else {
                lastErr = e3;
              }
            }
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

    // Auto-cache: nếu thành công và bật SNAPSHOT_CACHE_RTSP=1 thì lưu lại vào camera.rtspUrl
    if (process.env.SNAPSHOT_CACHE_RTSP === '1') {
      const allowOverride = process.env.SNAPSHOT_CACHE_OVERRIDE === '1';
      const current = cam.rtspUrl?.trim();
      if (!current || allowOverride) {
        // Chỉ lưu nếu URL không chứa credential mà ta muốn bỏ? Hiện dùng full URL để chắc chắn
        // Có thể cải tiến: chỉ lưu path. Với scope hiện tại lưu nguyên URL để lần sau khỏi dựng lại.
        cam.rtspUrl = successUrl;
        try {
          await this.camRepo.save(cam);
          if (process.env.DEBUG_SNAPSHOT) {
            const masked = successUrl.replace(/:\/\/[\w%.-]+:[^@]+@/, '://***:***@');
            // eslint-disable-next-line no-console
            console.debug('[SNAPSHOT] cached working rtsp_url', { cameraId: cam.id, rtsp: masked, override: !!current });
          }
        } catch (e) {
          // eslint-disable-next-line no-console
            console.warn('[SNAPSHOT] failed to cache rtsp_url', (e as Error).message);
        }
      }
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

  async remove(id: string) {
    const snap = await this.snapRepo.findOne({ where: { id } });
    if (!snap) throw new NotFoundException('Snapshot not found');
    // Thử xoá file nếu tồn tại
    if (snap.storagePath && existsSync(snap.storagePath)) {
      try { await unlink(snap.storagePath); } catch (e) {
        if (process.env.DEBUG_SNAPSHOT) {
          // eslint-disable-next-line no-console
          console.warn('[SNAPSHOT] unlink failed', (e as Error).message);
        }
      }
    }
    await this.snapRepo.delete(id);
    return { deleted: true };
  }
}
