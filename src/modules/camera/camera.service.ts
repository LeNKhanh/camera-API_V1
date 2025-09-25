// CameraService: Nghiệp vụ CRUD cho bảng cameras
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Camera } from '../../typeorm/entities/camera.entity';

@Injectable()
export class CameraService {
  constructor(@InjectRepository(Camera) private readonly repo: Repository<Camera>) {}

  // Tạo mới camera
  async create(dto: Partial<Camera>) {
    const entity = this.repo.create(dto);
    return this.repo.save(entity);
  }

  // Lấy tất cả camera
  // Lấy danh sách camera (tối ưu chỉ lấy cột cần)
  findAll() {
    // Chỉ lấy cột cần thiết để tăng tốc list
    return this.repo.find({
      select: {
        id: true,
        name: true,
        ipAddress: true,
        rtspPort: true,
        enabled: true,
        codec: true,
        resolution: true,
        createdAt: true,
        updatedAt: true,
      },
      order: { createdAt: 'DESC' },
    });
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
    this.repo.merge(cam, dto);
    return this.repo.save(cam);
  }

  // Xoá camera
  async remove(id: string) {
    const cam = await this.findOne(id);
    await this.repo.remove(cam);
    return { success: true };
  }
}
