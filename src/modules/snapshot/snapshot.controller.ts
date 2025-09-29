// SnapshotController: API chụp ảnh nhanh từ camera
// Luồng:
// - POST /snapshots/capture: chụp 1 frame đầu tiên và lưu file
// - GET /snapshots: liệt kê theo camera hoặc tất cả
// - GET /snapshots/:id: chi tiết
import { Body, Controller, Get, Param, Post, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { IsOptional, IsString, IsUUID } from 'class-validator';

import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { JwtAuthGuard } from '../guards/jwt.guard';
import { SnapshotService } from './snapshot.service';

class SnapshotCaptureDto {
  // Bắt buộc phải là UUID hợp lệ, tránh lỗi "invalid input syntax for type uuid" từ Postgres
  @IsUUID()
  cameraId: string;

  @IsOptional()
  @IsString()
  filename?: string; // tên file tùy chọn
}

class SnapshotQueryDto {
  @IsOptional()
  @IsUUID()
  cameraId?: string;
}

@Controller('snapshots')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SnapshotController {
  constructor(private readonly svc: SnapshotService) {}

  // Chụp một ảnh snapshot
  @Post('capture')
  @Roles('ADMIN', 'OPERATOR')
  capture(@Body() dto: SnapshotCaptureDto) {
    return this.svc.capture(dto.cameraId, dto.filename);
  }

  // Danh sách snapshot theo camera
  @Get()
  @Roles('ADMIN', 'OPERATOR', 'VIEWER')
  list(@Query() query: SnapshotQueryDto) {
    return this.svc.list(query.cameraId);
  }

  // Chi tiết
  @Get(':id')
  @Roles('ADMIN', 'OPERATOR', 'VIEWER')
  get(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.svc.get(id);
  }
}
