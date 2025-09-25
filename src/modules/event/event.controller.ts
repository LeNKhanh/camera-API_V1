// EventController: Quản lý sự kiện (MOTION/ERROR/ALERT)
// Luồng:
// - POST /events: tạo sự kiện gắn với camera
// - GET /events?cameraId=: liệt kê theo camera hoặc tất cả
// - GET /events/:id: chi tiết
import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsString } from 'class-validator';

import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { JwtAuthGuard } from '../guards/jwt.guard';
import { EventService } from './event.service';
import { EventType } from '../../typeorm/entities/event.entity';

class CreateEventDto {
  @IsString()
  cameraId: string;

  @IsIn(['MOTION', 'ERROR', 'ALERT'])
  type: EventType;

  @IsOptional()
  @IsString()
  description?: string;
}

@Controller('events')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EventController {
  constructor(private readonly svc: EventService) {}

  // Tạo sự kiện thủ công (ví dụ test); thực tế có thể sinh từ pipeline phân tích
  @Post()
  @Roles('ADMIN', 'OPERATOR')
  create(@Body() dto: CreateEventDto) {
    return this.svc.create(dto);
  }

  // Danh sách
  @Get()
  @Roles('ADMIN', 'OPERATOR', 'VIEWER')
  list(@Query('cameraId') cameraId?: string) {
    return this.svc.list(cameraId);
  }

  // Chi tiết
  @Get(':id')
  @Roles('ADMIN', 'OPERATOR', 'VIEWER')
  get(@Param('id') id: string) {
    return this.svc.get(id);
  }
}
