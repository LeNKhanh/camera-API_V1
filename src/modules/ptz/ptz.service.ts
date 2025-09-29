import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Camera } from '../../typeorm/entities/camera.entity';

export type PtzAction = 'PAN_LEFT' | 'PAN_RIGHT' | 'TILT_UP' | 'TILT_DOWN' | 'ZOOM_IN' | 'ZOOM_OUT' | 'STOP';

interface ActiveMove {
  action: PtzAction;
  startedAt: number;
  timeout?: NodeJS.Timeout;
}

@Injectable()
export class PtzService {
  private active = new Map<string, ActiveMove>();
  constructor(@InjectRepository(Camera) private readonly camRepo: Repository<Camera>) {}

  async execute(cameraId: string, action: PtzAction, speed = 1, durationMs?: number) {
    const cam = await this.camRepo.findOne({ where: { id: cameraId } });
    if (!cam) throw new NotFoundException('Camera not found');

    // Mapping hành động -> lệnh Dahua giả lập
    const map: Record<PtzAction, string> = {
      PAN_LEFT: 'DH_PTZ_LEFT_CONTROL',
      PAN_RIGHT: 'DH_PTZ_RIGHT_CONTROL',
      TILT_UP: 'DH_PTZ_UP_CONTROL',
      TILT_DOWN: 'DH_PTZ_DOWN_CONTROL',
      ZOOM_IN: 'DH_PTZ_ZOOM_ADD_CONTROL',
      ZOOM_OUT: 'DH_PTZ_ZOOM_DEC_CONTROL',
      STOP: 'DH_PTZ_STOP'
    };

    if (action === 'STOP') {
      const prev = this.active.get(cameraId);
      if (prev?.timeout) clearTimeout(prev.timeout);
      this.active.delete(cameraId);
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
    return {
      ok: true,
      cameraId,
      action,
      vendorCommand: map[action],
      speed,
      willAutoStopAfterMs: durationMs || null,
      startedAt
    };
  }

  status(cameraId: string) {
    const act = this.active.get(cameraId);
    if (!act) return { moving: false };
    return { moving: true, action: act.action, ms: Date.now() - act.startedAt };
  }
}
