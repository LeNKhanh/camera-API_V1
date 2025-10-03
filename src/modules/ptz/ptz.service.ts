import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Camera } from '../../typeorm/entities/camera.entity';
import { PtzLog } from '../../typeorm/entities/ptz-log.entity';

// Runtime enum object (dùng cho class-validator IsEnum)
// Thêm phần mở rộng .js để tránh lỗi khi chạy trong môi trường Node CommonJS sau build.
import { StandardPtzActionCodes } from './ptz-command-map';

export const PtzActions = {
  PAN_LEFT: 'PAN_LEFT',
  PAN_RIGHT: 'PAN_RIGHT',
  TILT_UP: 'TILT_UP',
  TILT_DOWN: 'TILT_DOWN',
  PAN_LEFT_UP: 'PAN_LEFT_UP',
  PAN_RIGHT_UP: 'PAN_RIGHT_UP',
  PAN_LEFT_DOWN: 'PAN_LEFT_DOWN',
  PAN_RIGHT_DOWN: 'PAN_RIGHT_DOWN',
  ZOOM_IN: 'ZOOM_IN',
  ZOOM_OUT: 'ZOOM_OUT',
  FOCUS_NEAR: 'FOCUS_NEAR',
  FOCUS_FAR: 'FOCUS_FAR',
  IRIS_OPEN: 'IRIS_OPEN',
  IRIS_CLOSE: 'IRIS_CLOSE',
  PRESET_GOTO: 'PRESET_GOTO',
  PRESET_SET: 'PRESET_SET',
  PRESET_DELETE: 'PRESET_DELETE',
  AUTO_SCAN_START: 'AUTO_SCAN_START',
  AUTO_SCAN_STOP: 'AUTO_SCAN_STOP',
  PATTERN_START: 'PATTERN_START',
  PATTERN_STOP: 'PATTERN_STOP',
  PATTERN_RUN: 'PATTERN_RUN',
  TOUR_START: 'TOUR_START',
  TOUR_STOP: 'TOUR_STOP',
  STOP: 'STOP',
} as const;
export type PtzAction = typeof PtzActions[keyof typeof PtzActions];

// Build mapping from external code list; unknown extended actions (AUTO_SCAN/PATTERN...) must exist in file
const commandCodeMap: Record<PtzAction, number> = {
  STOP: StandardPtzActionCodes.STOP,
  TILT_UP: StandardPtzActionCodes.TILT_UP,
  TILT_DOWN: StandardPtzActionCodes.TILT_DOWN,
  PAN_LEFT: StandardPtzActionCodes.PAN_LEFT,
  PAN_RIGHT: StandardPtzActionCodes.PAN_RIGHT,
  PAN_LEFT_UP: StandardPtzActionCodes.PAN_LEFT_UP,
  PAN_RIGHT_UP: StandardPtzActionCodes.PAN_RIGHT_UP,
  PAN_LEFT_DOWN: StandardPtzActionCodes.PAN_LEFT_DOWN,
  PAN_RIGHT_DOWN: StandardPtzActionCodes.PAN_RIGHT_DOWN,
  ZOOM_IN: StandardPtzActionCodes.ZOOM_IN,
  ZOOM_OUT: StandardPtzActionCodes.ZOOM_OUT,
  FOCUS_NEAR: StandardPtzActionCodes.FOCUS_NEAR,
  FOCUS_FAR: StandardPtzActionCodes.FOCUS_FAR,
  IRIS_OPEN: StandardPtzActionCodes.IRIS_OPEN,
  IRIS_CLOSE: StandardPtzActionCodes.IRIS_CLOSE,
  PRESET_GOTO: StandardPtzActionCodes.PRESET_GOTO,
  PRESET_SET: StandardPtzActionCodes.PRESET_SET,
  PRESET_DELETE: StandardPtzActionCodes.PRESET_DELETE,
  AUTO_SCAN_START: StandardPtzActionCodes.AUTO_SCAN_START,
  AUTO_SCAN_STOP: StandardPtzActionCodes.AUTO_SCAN_STOP,
  PATTERN_START: StandardPtzActionCodes.PATTERN_START,
  PATTERN_STOP: StandardPtzActionCodes.PATTERN_STOP,
  PATTERN_RUN: StandardPtzActionCodes.PATTERN_RUN,
  TOUR_START: StandardPtzActionCodes.TOUR_START,
  TOUR_STOP: StandardPtzActionCodes.TOUR_STOP,
};

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
  .where('l."ILoginID" = :cid', { cid: cameraId })
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

  async execute(cameraId: string, action: PtzAction, speed = 1, durationMs?: number, p1?: number, p2?: number, p3?: number) {
    this.initConfigOnce();
  const cam = await this.camRepo.findOne({ where: { id: cameraId } });
  if (!cam) throw new NotFoundException('Camera not found');
    const ILoginID = cam.id; // expose as ILoginID in response
    const nChannelID = cam.channel;

    // Throttle đơn giản tránh spam quá nhanh
    const now = Date.now();
    const last = this.lastCommandAt.get(cameraId) || 0;
    const delta = now - last;
    if (delta < this.throttleMs) {
      return {
        ok: false,
        throttled: true,
        minIntervalMs: this.throttleMs,
        ILoginID,
        nChannelID,
        ...(this.debugThrottle ? { lastDeltaMs: delta } : {})
      };
    }
    this.lastCommandAt.set(cameraId, now);

    // Param mapping theo bảng vendor: (đơn giản hoá)
    // - Up/Down dùng vertical speed param2 (1..8)
    // - Left/Right dùng horizontal speed param2 (1..8)
    // - Zoom/Focus/Iris dùng multi-speed param2
    // - Preset: param2 = preset number
    // - Diagonal: param1 vertical speed, param2 horizontal speed
    const normSpeed = Math.max(1, Math.min(10, speed || 1));
    let param1: number | null = null;
    let param2: number | null = null;
    let param3: number | null = null;
    switch (action) {
      case 'TILT_UP':
      case 'TILT_DOWN':
        param2 = normSpeed; break;
      case 'PAN_LEFT':
      case 'PAN_RIGHT':
        param2 = normSpeed; break;
      case 'ZOOM_IN':
      case 'ZOOM_OUT':
      case 'FOCUS_NEAR':
      case 'FOCUS_FAR':
      case 'IRIS_OPEN':
      case 'IRIS_CLOSE':
        param2 = normSpeed; break;
      case 'PRESET_GOTO':
      case 'PRESET_SET':
      case 'PRESET_DELETE':
        param2 = typeof p2 === 'number' ? p2 : p1 ?? 1; break;
      case 'PAN_LEFT_UP':
      case 'PAN_RIGHT_UP':
      case 'PAN_LEFT_DOWN':
      case 'PAN_RIGHT_DOWN':
        param1 = normSpeed; // vertical
        param2 = normSpeed; // horizontal
        break;
      case 'AUTO_SCAN_START':
      case 'AUTO_SCAN_STOP':
      case 'PATTERN_START':
      case 'PATTERN_STOP':
      case 'PATTERN_RUN':
      case 'TOUR_START':
      case 'TOUR_STOP':
        // Các lệnh mở rộng hiện tại không cần param mặc định
        break;
    }
    // Override nếu caller truyền cụ thể
    if (typeof p1 === 'number') param1 = p1;
    if (typeof p2 === 'number') param2 = p2;
    if (typeof p3 === 'number') param3 = p3;

    // Mapping speed -> vector pan/tilt/zoom (-1..1 * speed)
    let vectorPan = 0, vectorTilt = 0, vectorZoom = 0;
    switch (action) {
      case 'PAN_LEFT': vectorPan = -speed; break;
      case 'PAN_RIGHT': vectorPan = speed; break;
      case 'TILT_UP': vectorTilt = speed; break;
      case 'TILT_DOWN': vectorTilt = -speed; break;
      case 'ZOOM_IN': vectorZoom = speed; break;
      case 'ZOOM_OUT': vectorZoom = -speed; break;
      // Diagonal moves: combine pan & tilt components. We deliberately do NOT scale by 1/sqrt(2)
      // to preserve supplied speed on both axes (vendor protocol often accepts independent speeds).
      // If you want normalized diagonal magnitude, adjust with: const diag = speed / Math.SQRT2.
      case 'PAN_LEFT_UP': vectorPan = -speed; vectorTilt = speed; break;
      case 'PAN_RIGHT_UP': vectorPan = speed; vectorTilt = speed; break;
      case 'PAN_LEFT_DOWN': vectorPan = -speed; vectorTilt = -speed; break;
      case 'PAN_RIGHT_DOWN': vectorPan = speed; vectorTilt = -speed; break;
      case 'STOP':
        // STOP resets vectors
        vectorPan = 0; vectorTilt = 0; vectorZoom = 0; break;
      default:
        // Các lệnh không ảnh hưởng vector (preset / pattern / tour / auto scan)
        break;
    }

    if (action === 'STOP') {
      const prev = this.active.get(cameraId);
      if (prev?.timeout) clearTimeout(prev.timeout);
      this.active.delete(cameraId);
      // Log STOP
      await this.logRepo.save(this.logRepo.create({
        ILoginID: ILoginID, // tạm dùng camera.id làm handle
        nChannelID: nChannelID,
        action,
        speed,
        vectorPan,
        vectorTilt,
        vectorZoom,
        commandCode: commandCodeMap[action],
        param1, param2, param3,
        durationMs: 0
      }));
      // Prune sau khi lưu
      this.pruneLogs(cameraId).catch(() => {/* ignore prune errors */});
      return { ok: true, ILoginID, nChannelID, stopped: true };  
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
      ILoginID,
      nChannelID,
      action,
      speed,
      vectorPan,
      vectorTilt,
      vectorZoom,
      commandCode: commandCodeMap[action],
      param1, param2, param3,
      durationMs: durationMs || null,
    }));
    // Prune async (không chặn response)
    this.pruneLogs(cameraId).catch(() => {/* ignore prune errors */});

    return {
      ok: true,
      ILoginID,
      nChannelID,
      action,
      dwPTZCommand: commandCodeMap[action],
      speed,
      vector: { pan: vectorPan, tilt: vectorTilt, zoom: vectorZoom },
      params: { param1, param2, param3 },
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

  async logs(cameraId: string) {
    // Lấy tối đa maxLogsPerCamera bản ghi gần nhất cho camera
    this.initConfigOnce();
    return this.logRepo.createQueryBuilder('l')
      .select(['l.id','l.ILoginID','l.nChannelID','l.action','l.commandCode','l.speed','l.vectorPan','l.vectorTilt','l.vectorZoom','l.param1','l.param2','l.param3','l.durationMs','l.createdAt'])
      .where('l."ILoginID" = :cid', { cid: cameraId })
      .orderBy('l.createdAt','DESC')
      .limit(this.maxLogsPerCamera)
      .getMany();
  }

  // Advanced logs query theo ILoginID & nChannelID + pagination
  async advancedLogs(opts: { ILoginID?: string; nChannelID?: number; page?: number; pageSize?: number }) {
    this.initConfigOnce();
    const qb = this.logRepo.createQueryBuilder('l')
      .select(['l.id','l.ILoginID','l.nChannelID','l.action','l.commandCode','l.speed','l.vectorPan','l.vectorTilt','l.vectorZoom','l.param1','l.param2','l.param3','l.durationMs','l.createdAt'])
      .orderBy('l.created_at','DESC');
    if (opts.ILoginID) qb.andWhere('l."ILoginID" = :ilogin', { ilogin: opts.ILoginID });
    if (typeof opts.nChannelID === 'number' && !isNaN(opts.nChannelID)) qb.andWhere('l.nChannelID = :chn', { chn: opts.nChannelID });
    const page = opts.page && opts.page > 0 ? opts.page : undefined;
    const pageSize = opts.pageSize && opts.pageSize > 0 ? Math.min(opts.pageSize, 200) : undefined;
    if (page && pageSize) {
      qb.skip((page - 1) * pageSize).take(pageSize);
      const [rows, total] = await qb.getManyAndCount();
      return {
        data: rows,
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 1 },
        filtersApplied: { ILoginID: opts.ILoginID || null, nChannelID: opts.nChannelID ?? null },
      };
    }
    return qb.getMany();
  }
}
