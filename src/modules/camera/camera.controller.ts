// CameraController: Quản lý CRUD cho thiết bị camera
// Luồng:
// - POST /cameras: tạo mới (ADMIN/OPERATOR)
// - GET /cameras: danh sách (tất cả vai trò đã đăng nhập)
// - GET /cameras/:id: chi tiết
// - PATCH /cameras/:id: cập nhật (ADMIN/OPERATOR)
// - DELETE /cameras/:id: xóa (ADMIN)
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { JwtAuthGuard } from '../guards/jwt.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';

import { CameraService } from './camera.service';

// DTO tạo/cập nhật camera
class CreateCameraDto {
  @IsString()
  name: string;

  @IsString()
  ipAddress: string;

  @IsOptional()
  @IsString()
  rtspUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  rtspPort?: number = 554;

  @IsOptional()
  @IsString()
  onvifUrl?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  codec?: string = 'H.264';

  @IsOptional()
  @IsString()
  resolution?: string = '1080p';

  @IsOptional()
  @IsBoolean()
  enabled?: boolean = true;
}

class UpdateCameraDto extends CreateCameraDto {}

@Controller('cameras')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CameraController {
  constructor(private readonly cameraService: CameraService) {}

  // Tạo camera (chỉ admin/operator)
  @Post()
  @Roles('ADMIN', 'OPERATOR')
  create(@Body() dto: CreateCameraDto) {
    return this.cameraService.create(dto);
  }

  // Danh sách camera (mọi vai trò đã đăng nhập)
  @Get()
  @Roles('ADMIN', 'OPERATOR', 'VIEWER')
  findAll() {
    return this.cameraService.findAll();
  }

  // Chi tiết camera
  @Get(':id')
  @Roles('ADMIN', 'OPERATOR', 'VIEWER')
  findOne(@Param('id') id: string) {
    return this.cameraService.findOne(id);
  }

  // Sửa camera
  @Patch(':id')
  @Roles('ADMIN', 'OPERATOR')
  update(@Param('id') id: string, @Body() dto: UpdateCameraDto) {
    return this.cameraService.update(id, dto);
  }

  // Xóa camera
  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.cameraService.remove(id);
  }
}
