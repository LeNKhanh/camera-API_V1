// EventService: Nghiệp vụ tạo và truy vấn sự kiện
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Event } from '../../typeorm/entities/event.entity';
import { Camera } from '../../typeorm/entities/camera.entity';

// Service quản lý Events (MOTION/ERROR/ALERT)
@Injectable()
export class EventService {
  constructor(
    @InjectRepository(Event) private readonly eventRepo: Repository<Event>,
    @InjectRepository(Camera) private readonly camRepo: Repository<Camera>,
  ) {}

  // Tạo sự kiện gắn camera
  async create(dto: { cameraId: string; type: any; description?: string }) {
    const cam = await this.camRepo.findOne({ where: { id: dto.cameraId } });
    if (!cam) throw new NotFoundException('Camera not found');
    // Tạo event gắn với camera và lấy channel từ camera
    const ev = this.eventRepo.create({
      camera: cam,
      nChannelID: cam.channel || 1, // Lấy channel từ camera
      type: dto.type,
      description: dto.description,
    } as any);
    return this.eventRepo.save(ev);
  }

  // Danh sách có thể lọc theo camera và channel
  list(cameraId?: string, nChannelID?: number) {
    const where: any = {};
    if (cameraId) where.camera = { id: cameraId };
    if (nChannelID !== undefined) where.nChannelID = nChannelID;

    return this.eventRepo.find({
      where: Object.keys(where).length > 0 ? where : undefined,
      relations: ['camera'],
      order: { createdAt: 'DESC' },
    });
  }

  // Chi tiết sự kiện
  async get(id: string) {
    const ev = await this.eventRepo.findOne({ where: { id }, relations: ['camera'] });
    if (!ev) throw new NotFoundException('Event not found');
    return ev;
  }

  // Ack sự kiện
  async ack(id: string) {
    const ev = await this.get(id);
    if (ev.ack) return { ok: true, already: true };
    await this.eventRepo.update(ev.id, { ack: true } as any);
    return { ok: true };
  }

  // Giả lập motion: tạo sự kiện MOTION cho camera
  async simulateMotion(cameraId: string, description?: string) {
    const cam = await this.camRepo.findOne({ where: { id: cameraId } });
    if (!cam) throw new NotFoundException('Camera not found');
    
    return this.create({
      cameraId,
      type: 'MOTION',
      description: description || `Simulated motion for camera ${cam.name}`,
    });
  }

  // Xóa 1 event theo id
  async deleteOne(id: string) {
    const existing = await this.eventRepo.findOne({ where: { id } });
    if (!existing) throw new NotFoundException('Event not found');
    await this.eventRepo.delete(id);
    return { ok: true, deletedId: id };
  }

  // Xóa tất cả event của 1 camera
  async deleteByCamera(cameraId: string) {
    const cam = await this.camRepo.findOne({ where: { id: cameraId } });
    if (!cam) throw new NotFoundException('Camera not found');
    const res = await this.eventRepo.createQueryBuilder()
      .delete()
      .from(Event)
      .where('camera_id = :cid', { cid: cameraId })
      .execute();
    return { ok: true, cameraId, affected: res.affected || 0 };
  }
}
