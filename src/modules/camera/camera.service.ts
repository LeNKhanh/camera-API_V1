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
  async create(dto: any) {
    this.validateIp(dto.ipAddress);
    const cam: Partial<Camera> = {
      name: dto.name,
      ipAddress: dto.ipAddress,
      sdkPort: dto.port,
      username: dto.username,
      password: dto.password,
      rtspPort: dto.rtspPort ?? 554,
      vendor: 'dahua',
      codec: dto.codec || 'H.264',
      resolution: dto.resolution || '1080p',
      enabled: typeof dto.enabled === 'boolean' ? dto.enabled : true,
    };
    cam.rtspUrl = dto.rtspUrl || `rtsp://${encodeURIComponent(cam.username!)}:${encodeURIComponent(cam.password!)}@${cam.ipAddress}:${cam.rtspPort}/cam/realmonitor?channel=1&subtype=0`;
    const entity = this.repo.create(cam);
    return this.repo.save(entity);
  }

  // Lấy danh sách camera với filter, hỗ trợ pagination + sort + date range
  async findAll(filter?: {
    enabled?: boolean;
    name?: string;
  vendor?: string; // deprecated – ignored
    createdFrom?: Date;
    createdTo?: Date;
    page?: number;
    pageSize?: number;
    sortBy?: 'createdAt' | 'name' | 'vendor';
    sortDir?: 'ASC' | 'DESC';
  }) {
    const qb = this.repo.createQueryBuilder('c')
      .select([
        'c.id', 'c.name', 'c.ipAddress', 'c.sdkPort', 'c.rtspPort', 'c.enabled', 'c.codec', 'c.resolution', 'c.createdAt', 'c.updatedAt'
      ]);

    if (filter) {
      if (typeof filter.enabled === 'boolean') {
        qb.andWhere('c.enabled = :enabled', { enabled: filter.enabled });
      }
      if (filter.name && filter.name.trim().length > 0) {
        qb.andWhere('LOWER(c.name) LIKE :name', { name: `%${filter.name.toLowerCase()}%` });
      }
      // vendor filter removed (fixed to dahua)
      if (filter.createdFrom) {
        qb.andWhere('c.createdAt >= :from', { from: filter.createdFrom });
      }
      if (filter.createdTo) {
        qb.andWhere('c.createdAt <= :to', { to: filter.createdTo });
      }
    }

    // Sort
    const sortBy = filter?.sortBy || 'createdAt';
    const sortDir = filter?.sortDir || 'DESC';
  const allowedSort: Record<string, string> = { createdAt: 'c.createdAt', name: 'c.name' };
    qb.orderBy(allowedSort[sortBy] || 'c.createdAt', sortDir === 'ASC' ? 'ASC' : 'DESC');

    // Pagination (chỉ áp dụng nếu page/pageSize hợp lệ)
    const page = filter?.page && filter.page > 0 ? filter.page : undefined;
    const pageSize = filter?.pageSize && filter.pageSize > 0 ? Math.min(filter.pageSize, 100) : undefined;
    if (page && pageSize) {
      qb.skip((page - 1) * pageSize).take(pageSize);
      const [rows, total] = await qb.getManyAndCount();
      return {
        data: rows,
        pagination: {
          page,
            pageSize,
          total,
          totalPages: Math.ceil(total / pageSize) || 1,
        },
        sort: { sortBy, sortDir },
        filtersApplied: {
          enabled: filter?.enabled,
          name: filter?.name,
          // vendor removed
          createdFrom: filter?.createdFrom,
          createdTo: filter?.createdTo,
        }
      };
    }
    // Không pagination: trả về mảng đơn giản (giữ backward compatibility)
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
