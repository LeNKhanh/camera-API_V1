import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Camera } from '../../typeorm/entities/camera.entity';
import { PtzLog } from '../../typeorm/entities/ptz-log.entity';

// Runtime enum object (dùng cho class-validator IsEnum)
export const PtzActions = {
  PAN_LEFT: 'PAN_LEFT',
  PAN_RIGHT: 'PAN_RIGHT',
  TILT_UP: 'TILT_UP',
  TILT_DOWN: 'TILT_DOWN',
  ZOOM_IN: 'ZOOM_IN',
  ZOOM_OUT: 'ZOOM_OUT',
  STOP: 'STOP',
} as const;
export type PtzAction = typeof PtzActions[keyof typeof PtzActions];

interface ActiveMove {
  action: PtzAction;
  startedAt: number;
  timeout?: NodeJS.Timeout;
}

@Injectable()
export class PtzService {
  private active = new Map<string, ActiveMove>();
  // Throttle: lưu timestamp lệnh cuối theo cameraId
  private lastCommandAt = new Map<string, number>();
  private throttleMs = 200; // tối thiểu 200ms giữa 2 lệnh (có thể override qua ENV PTZ_THROTTLE_MS)
  private debugThrottle = false; // PTZ_THROTTLE_DEBUG=1 để trả thêm lastDeltaMs
  private maxLogsPerCamera = 10; // giữ tối đa 10 log gần nhất mỗi camera (PTZ_LOG_MAX override)

  constructor(
    @InjectRepository(Camera) private readonly camRepo: Repository<Camera>,
    @InjectRepository(PtzLog) private readonly logRepo: Repository<PtzLog>,
  ) {}

  private initConfigOnce() {
    // Lazy init để chắc chắn biến môi trường đã được load
    if ((this as any)._cfgInited) return;
    const envMs = process.env.PTZ_THROTTLE_MS;
    if (envMs && !isNaN(Number(envMs))) {
      const v = parseInt(envMs, 10);
      if (v >= 0 && v <= 10000) this.throttleMs = v; // giới hạn an toàn
    }
    this.debugThrottle = process.env.PTZ_THROTTLE_DEBUG === '1';
    const maxEnv = process.env.PTZ_LOG_MAX;
    if (maxEnv && !isNaN(Number(maxEnv))) {
      const mv = parseInt(maxEnv, 10);
      if (mv >= 1 && mv <= 200) this.maxLogsPerCamera = mv; // giới hạn mềm
    }
    (this as any)._cfgInited = true;
  }

  private async pruneLogs(cameraId: string) {
    // Xóa tất cả log cũ ngoài N bản mới nhất
    // Dùng subquery OFFSET để lấy id cần xóa
    const maxKeep = this.maxLogsPerCamera;
    // Postgres đặc thù: cần subselect; QueryBuilder hỗ trợ OFFSET
    const idsToDelete = await this.logRepo.createQueryBuilder('l')
      .select('l.id', 'id')
      .where('l.camera_id = :cid', { cid: cameraId })
      .orderBy('l.created_at', 'DESC')
      .offset(maxKeep)
      .getRawMany<{ id: string }>();
    if (idsToDelete.length === 0) return;
    const idList = idsToDelete.map(r => r.id);
    await this.logRepo.createQueryBuilder()
      .delete()
      .from(PtzLog)
      .where('id IN (:...ids)', { ids: idList })
      .execute();
  }

  async execute(cameraId: string, action: PtzAction, speed = 1, durationMs?: number) {
    this.initConfigOnce();
    const cam = await this.camRepo.findOne({ where: { id: cameraId } });
    if (!cam) throw new NotFoundException('Camera not found');

    // Throttle đơn giản tránh spam quá nhanh
    const now = Date.now();
    const last = this.lastCommandAt.get(cameraId) || 0;
    const delta = now - last;
    if (delta < this.throttleMs) {
      return {
        ok: false,
        throttled: true,
        minIntervalMs: this.throttleMs,
        ...(this.debugThrottle ? { lastDeltaMs: delta } : {})
      };
    }
    this.lastCommandAt.set(cameraId, now);

    // Mapping hành động -> lệnh Dahua giả lập
    const map: Record<PtzAction, string> = {
      PAN_LEFT: 'DH_PTZ_LEFT_CONTROL',
      PAN_RIGHT: 'DH_PTZ_RIGHT_CONTROL',
      TILT_UP: 'DH_PTZ_UP_CONTROL',
      TILT_DOWN: 'DH_PTZ_DOWN_CONTROL',
      ZOOM_IN: 'DH_PTZ_ZOOM_ADD_CONTROL',
      ZOOM_OUT: 'DH_PTZ_ZOOM_DEC_CONTROL',
      STOP: 'DH_PTZ_STOP'
    } as const;

    // Mapping speed -> vector pan/tilt/zoom (-1..1 * speed)
    let vectorPan = 0, vectorTilt = 0, vectorZoom = 0;
    switch (action) {
      case 'PAN_LEFT': vectorPan = -speed; break;
      case 'PAN_RIGHT': vectorPan = speed; break;
      case 'TILT_UP': vectorTilt = speed; break;
      case 'TILT_DOWN': vectorTilt = -speed; break;
      case 'ZOOM_IN': vectorZoom = speed; break;
      case 'ZOOM_OUT': vectorZoom = -speed; break;
      case 'STOP':
        // STOP resets vectors
        vectorPan = 0; vectorTilt = 0; vectorZoom = 0; break;
    }

    if (action === 'STOP') {
      const prev = this.active.get(cameraId);
      if (prev?.timeout) clearTimeout(prev.timeout);
      this.active.delete(cameraId);
      // Log STOP
      await this.logRepo.save(this.logRepo.create({
        camera: cam,
        action,
        speed,
        vectorPan,
        vectorTilt,
        vectorZoom,
        durationMs: 0
      }));
      // Prune sau khi lưu
      this.pruneLogs(cameraId).catch(() => {/* ignore prune errors */});
      return { ok: true, cameraId, stopped: true };  
    }

    // Hủy chuyển động cũ nếu còn
    const existing = this.active.get(cameraId);
    if (existing?.timeout) clearTimeout(existing.timeout);

    const startedAt = Date.now();
    const record: ActiveMove = { action, startedAt };
    if (durationMs && durationMs > 0) {
      record.timeout = setTimeout(() => {
        this.active.delete(cameraId);
      }, durationMs);
    }
    this.active.set(cameraId, record);

    // Trả về giả lập (sau này có thể gọi ONVIF SDK thật)
    // Ghi log
    await this.logRepo.save(this.logRepo.create({
      camera: cam,
      action,
      speed,
      vectorPan,
      vectorTilt,
      vectorZoom,
      durationMs: durationMs || null,
    }));
    // Prune async (không chặn response)
    this.pruneLogs(cameraId).catch(() => {/* ignore prune errors */});

    return {
      ok: true,
      cameraId,
      action,
      vendorCommand: map[action],
      speed,
      vector: { pan: vectorPan, tilt: vectorTilt, zoom: vectorZoom },
      willAutoStopAfterMs: durationMs || null,
      startedAt,
      ...(this.debugThrottle ? { lastDeltaMs: delta } : {})
    };
  }

  status(cameraId: string) {
    const act = this.active.get(cameraId);
    if (!act) return { moving: false };
    return { moving: true, action: act.action, ms: Date.now() - act.startedAt };
  }
}
