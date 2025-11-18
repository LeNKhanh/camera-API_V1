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
    // Logic: Ưu tiên dùng channel từ request, nếu không có thì mặc định = 1
    let channel = dto.channel && dto.channel > 0 ? dto.channel : 1;
    
    // Kiểm tra duplicate (ipAddress, channel)
    const duplicate = await this.repo.findOne({ 
      where: { ipAddress: dto.ipAddress, channel } 
    });
    
    if (duplicate) {
      // Nếu channel bị trùng -> tìm channel tiếp theo available
      const existing = await this.repo.createQueryBuilder('c')
        .select('MAX(c.channel)', 'max')
        .where('c.ipAddress = :ip', { ip: dto.ipAddress })
        .getRawOne<{ max: number | null }>();
      channel = (existing?.max || 0) + 1;
    }
    
    const cam: Partial<Camera> = {
      name: dto.name,
      ipAddress: dto.ipAddress,
      sdkPort: dto.sdkPort ?? 37777,
      onvifPort: dto.onvifPort ?? 80,
      channel,
      username: dto.username,
      password: dto.password,
      rtspPort: dto.rtspPort ?? 554,
      vendor: dto.vendor || 'dahua',
      codec: dto.codec || 'H.264',
      resolution: dto.resolution || '1080p',
      enabled: typeof dto.enabled === 'boolean' ? dto.enabled : true,
    };
    cam.rtspUrl = dto.rtspUrl || this.buildRtsp(cam, channel);
    const entity = this.repo.create(cam);
    return this.repo.save(entity);
  }

  // Bulk create multiple channels for same device (e.g., NVR with n channels)
  async createMulti(dto: any & { channels: number }) {
    this.validateIp(dto.ipAddress);
    const total = dto.channels && dto.channels > 0 ? Math.min(dto.channels, 256) : 1;
    const results: Camera[] = [];
    for (let ch = 1; ch <= total; ch++) {
      const partial: Partial<Camera> = {
        name: `${dto.name || 'Cam'} CH${ch}`,
        ipAddress: dto.ipAddress,
        sdkPort: dto.sdkPort ?? dto.port ?? 37777,
        onvifPort: dto.onvifPort ?? 80,
        channel: ch,
        username: dto.username,
        password: dto.password,
        rtspPort: dto.rtspPort ?? 554,
        vendor: dto.vendor || 'dahua',
        codec: dto.codec || 'H.264',
        resolution: dto.resolution || '1080p',
        enabled: true,
      };
      partial.rtspUrl = this.buildRtsp(partial, ch);
      const entity = this.repo.create(partial);
      try {
        results.push(await this.repo.save(entity));
      } catch (e: any) {
        // Skip duplicates (unique constraint) silently when rerun
        if (!/unique/i.test(e.message)) throw e;
      }
    }
    return results;
  }

  private buildRtsp(cam: Partial<Camera>, channel: number) {
    const user = encodeURIComponent(cam.username!);
    const pass = encodeURIComponent(cam.password!);
    const host = cam.ipAddress;
    const port = cam.rtspPort || 554;
    // Dahua typical pattern: /cam/realmonitor?channel={n}&subtype=0
    return `rtsp://${user}:${pass}@${host}:${port}/cam/realmonitor?channel=${channel}&subtype=0`;
  }

  // Lấy danh sách camera với filter, hỗ trợ pagination + sort + date range
  async findAll(filter?: {
    enabled?: boolean;
    name?: string;
  vendor?: string; // deprecated – ignored
    ipAddress?: string;
    channel?: number;
    createdFrom?: Date;
    createdTo?: Date;
    page?: number;
    pageSize?: number;
    sortBy?: 'createdAt' | 'name' | 'vendor';
    sortDir?: 'ASC' | 'DESC';
  }) {
    const qb = this.repo.createQueryBuilder('c')
      .select([
        'c.id', 'c.name', 'c.ipAddress', 'c.channel', 'c.sdkPort', 'c.rtspPort', 'c.enabled', 'c.codec', 'c.resolution', 'c.createdAt', 'c.updatedAt'
      ]);

    if (filter) {
      if (typeof filter.enabled === 'boolean') {
        qb.andWhere('c.enabled = :enabled', { enabled: filter.enabled });
      }
      if (filter.name && filter.name.trim().length > 0) {
        qb.andWhere('LOWER(c.name) LIKE :name', { name: `%${filter.name.toLowerCase()}%` });
      }
      if (filter.ipAddress && filter.ipAddress.trim().length > 0) {
        qb.andWhere('c.ipAddress = :ip', { ip: filter.ipAddress.trim() });
      }
      if (typeof filter.channel === 'number' && filter.channel > 0) {
        qb.andWhere('c.channel = :channel', { channel: filter.channel });
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
          ipAddress: filter?.ipAddress,
          channel: filter?.channel,
          // vendor removed
          createdFrom: filter?.createdFrom,
          createdTo: filter?.createdTo,
        }
      };
    }
    // Không pagination: trả về mảng đơn giản (giữ backward compatibility)
    return qb.getMany();
  }

  // (nextAvailableChannel bị loại bỏ: chuyển sang mô hình max+1 tuần tự)

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
    // Nếu cập nhật channel: đảm bảo unique trong (ipAddress, channel)
    if (dto.channel && dto.channel > 0) {
      const targetIp = dto.ipAddress || cam.ipAddress;
      const duplicate = await this.repo.findOne({ where: { ipAddress: targetIp, channel: dto.channel } });
      if (duplicate && duplicate.id !== cam.id) {
        // Theo quy tắc create: nếu channel bị chiếm -> gán MAX+1
        const existing = await this.repo.createQueryBuilder('c')
          .select('MAX(c.channel)', 'max')
          .where('c.ipAddress = :ip', { ip: targetIp })
          .getRawOne<{ max: number | null }>();
        dto.channel = (existing?.max || 0) + 1;
      }
    }
    // Nếu đổi username/password mà không cung cấp rtspUrl tùy chỉnh -> rebuild rtspUrl
    const needRebuildRtsp = (dto.username || dto.password || dto.rtspPort) && !dto.rtspUrl;
    this.repo.merge(cam, dto);
    if (needRebuildRtsp) {
      cam.rtspUrl = this.buildRtsp(cam, cam.channel);
    }
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
    // Không dùng -stimeout (không có trong ffmpeg cũ), dùng timeout wrapper + rw_timeout
    const args = [
      '-hide_banner',
      '-rtsp_transport', 'tcp',
      '-timeout', String(timeoutMs * 1000), // microseconds (connection + read timeout)
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
      }, timeoutMs + 500); // Thêm 500ms buffer cho ffmpeg tự timeout trước
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
          else if (/timed? out|timeout/.test(text)) reason = 'TIMEOUT';
          else if (/connection refused|no route to host|network is unreachable|unable to connect|connection timed out/.test(text)) reason = 'CONN';
          else if (/not found|404/.test(text)) reason = 'NOT_FOUND';
          resolve({ ok: false, status: reason, rtsp, ms: Date.now() - started, stderr });
        }
      });
    });
  }

  // Capture a snapshot (JPEG) at current time
  async snapshot(id: string) {
    const cam = await this.findOne(id);
    const rtsp = cam.rtspUrl || this.buildRtsp(cam, cam.channel);
    const timeoutMs = parseInt(process.env.CAMERA_SNAPSHOT_TIMEOUT_MS || '7000', 10);

    return new Promise<Buffer>((resolve, reject) => {
      const args = [
        '-hide_banner',
        '-loglevel', 'error',
        '-rtsp_transport', 'tcp',
        '-timeout', String(timeoutMs * 1000),
        '-i', rtsp,
        '-frames:v', '1',
        '-q:v', process.env.CAMERA_SNAPSHOT_QUALITY || '2',
        '-f', 'image2',
        '-vcodec', 'mjpeg',
        '-',
      ];

      const child = spawn(ffmpegPath || 'ffmpeg', args, {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const chunks: Buffer[] = [];
      let stderr = '';
      let settled = false;

      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          try { child.kill('SIGKILL'); } catch {}
          reject(new BadRequestException('Snapshot timeout'));
        }
      }, timeoutMs + 500);

      child.stdout?.on('data', (chunk) => chunks.push(chunk as Buffer));
      child.stderr?.on('data', (d) => { stderr += d.toString(); });
      child.on('error', (err) => {
        if (settled) return;
        clearTimeout(timer);
        settled = true;
        reject(err);
      });
      child.on('close', (code) => {
        if (settled) return;
        clearTimeout(timer);
        settled = true;
        if (code === 0 && chunks.length) {
          resolve(Buffer.concat(chunks));
        } else {
          reject(new BadRequestException(stderr || `Snapshot failed (code ${code})`));
        }
      });
    });
  }
}
