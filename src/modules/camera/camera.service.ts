// CameraService: Nghiệp vụ CRUD cho bảng cameras
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Camera } from '../../typeorm/entities/camera.entity';

@Injectable()
export class CameraService {
  constructor(@InjectRepository(Camera) private readonly repo: Repository<Camera>) {}

  // Tạo mới camera
  async create(dto: Partial<Camera>) {
    this.validateIp(dto.ipAddress);
    const entity = this.repo.create(dto);
    return this.repo.save(entity);
  }

  // Lấy danh sách camera với filter optional: enabled, name chứa, vendor
  async findAll(filter?: { enabled?: boolean; name?: string; vendor?: string }) {
    const qb = this.repo.createQueryBuilder('c')
      .select(['c.id', 'c.name', 'c.ipAddress', 'c.rtspPort', 'c.enabled', 'c.codec', 'c.resolution', 'c.vendor', 'c.createdAt', 'c.updatedAt'])
      .orderBy('c.createdAt', 'DESC');
    if (filter) {
      if (typeof filter.enabled === 'boolean') {
        qb.andWhere('c.enabled = :enabled', { enabled: filter.enabled });
      }
      if (filter.name && filter.name.trim().length > 0) {
        qb.andWhere('LOWER(c.name) LIKE :name', { name: `%${filter.name.toLowerCase()}%` });
      }
      if (filter.vendor && filter.vendor.trim().length > 0) {
        qb.andWhere('LOWER(c.vendor) = :vendor', { vendor: filter.vendor.toLowerCase() });
      }
    }
    return qb.getMany();
  }

  // Lấy 1 camera theo id
  async findOne(id: string) {
    const cam = await this.repo.findOne({ where: { id } });
    if (!cam) throw new NotFoundException('Camera not found');
    return cam;
  }

  // Cập nhật camera
  async update(id: string, dto: Partial<Camera>) {
    const cam = await this.findOne(id);
    if (dto.ipAddress) this.validateIp(dto.ipAddress);
    this.repo.merge(cam, dto);
    return this.repo.save(cam);
  }

  // Xoá camera
  async remove(id: string) {
    const cam = await this.findOne(id);
    await this.repo.remove(cam);
    return { success: true };
  }

  // -------------------- Validation & Utilities --------------------
  private validateIp(ip?: string) {
    if (!ip) throw new BadRequestException('ipAddress required');
    // IPv4 strict: 0-255 each octet; reject leading zeros >1 digit (e.g., 01) except 0 itself
    const ipv4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
    // IPv6 compact (basic check) – allow hex groups & :: compression
    const ipv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(([0-9a-fA-F]{1,4}:){1,7}:)|(([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4})|(([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2})|(([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3})|(([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4})|(([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5})|([0-9a-fA-F]{1,4}:)((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/;
    if (!(ipv4.test(ip) || ipv6.test(ip))) {
      throw new BadRequestException('Invalid IP address format');
    }
  }

  // Verify reachability: thử mở kết nối RTSP (tcp) trong timeout ngắn bằng ffmpeg
  async verify(id: string) {
    const cam = await this.findOne(id);
    const rtsp = cam.rtspUrl || `rtsp://${cam.username || 'admin'}:${cam.password || 'admin'}@${cam.ipAddress}:${cam.rtspPort || 554}`;
    const timeoutMs = parseInt(process.env.CAMERA_VERIFY_TIMEOUT_MS || '4000', 10);
    const args = [
      '-hide_banner',
      '-rtsp_transport', 'tcp',
      '-stimeout', String(timeoutMs * 1000), // microseconds
      '-i', rtsp,
      '-frames:v', '1',
      '-f', 'null', '-',
    ];
    const started = Date.now();
    return new Promise((resolve) => {
      const child = spawn(ffmpegPath || 'ffmpeg', args, { windowsHide: true });
      let stderr = '';
      let resolved = false;
      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          try { child.kill('SIGKILL'); } catch {}
          resolve({ ok: false, status: 'TIMEOUT', rtsp, ms: Date.now() - started });
        }
      }, timeoutMs);
      child.stderr?.on('data', d => { stderr += d.toString(); });
      child.on('close', (code) => {
        if (resolved) return;
        clearTimeout(timer);
        resolved = true;
        if (code === 0) {
          resolve({ ok: true, status: 'OK', rtsp, ms: Date.now() - started });
        } else {
          const text = stderr.toLowerCase();
            let reason = 'UNKNOWN';
            if (/401|unauthorized|auth/.test(text)) reason = 'AUTH';
            else if (/timed? out|stimeout/.test(text)) reason = 'TIMEOUT';
            else if (/connection refused|no route to host|network is unreachable|unable to connect|connection timed out/.test(text)) reason = 'CONN';
            else if (/not found|404/.test(text)) reason = 'NOT_FOUND';
          resolve({ ok: false, status: reason, rtsp, ms: Date.now() - started, stderr: stderr.slice(0, 300) });
        }
      });
    });
  }
}
