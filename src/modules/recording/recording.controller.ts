// RecordingController: Điều khiển các API ghi hình
// Luồng:
// - POST /recordings/start: bắt đầu ghi trong X giây từ cameraId
// - GET /recordings?cameraId=: liệt kê theo camera hoặc tất cả
// - GET /recordings/:id: xem chi tiết/trạng thái
import { Body, Controller, Get, Param, Post, Query, UseGuards, Put, Res } from '@nestjs/common';
import { Response } from 'express';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { JwtAuthGuard } from '../guards/jwt.guard';
import { RecordingService } from './recording.service';

class StartRecordingDto {
  @IsString()
  cameraId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationSec?: number = 60; // thời lượng mặc định 60s

  // Chiến lược: RTSP (mặc định) | FAKE (generate synthetic) | future SDK
  @IsOptional()
  @IsString()
  strategy?: string;

  // Tên file tùy chọn
  @IsOptional()
  @IsString()
  filename?: string;
}

@Controller('recordings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RecordingController {
  constructor(private readonly svc: RecordingService) {}

  // Bắt đầu ghi từ một camera trong X giây
  @Post('start')
  @Roles('ADMIN', 'OPERATOR')
  start(@Body() dto: StartRecordingDto) {
    return this.svc.startRecording(dto.cameraId, dto.durationSec ?? 60, dto.strategy, dto.filename);
  }

  // Danh sách bản ghi theo camera
  @Get()
  @Roles('ADMIN', 'OPERATOR', 'VIEWER')
  list(
    @Query('cameraId') cameraId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.svc.listRecordingsFiltered({ cameraId, from, to });
  }

  // Trạng thái / chi tiết bản ghi
  @Get(':id')
  @Roles('ADMIN', 'OPERATOR', 'VIEWER')
  get(@Param('id') id: string) {
    return this.svc.getRecording(id);
  }

  // Dừng bản ghi đang chạy
  @Put(':id/stop')
  @Roles('ADMIN', 'OPERATOR')
  stop(@Param('id') id: string) {
    return this.svc.stopRecording(id);
  }

  // Tải file mp4 (stream) – chỉ ADMIN/OPERATOR (viewer có thể tùy biến nếu muốn)
  @Get(':id/download')
  @Roles('ADMIN','OPERATOR')
  async download(@Param('id') id: string, @Res() res: Response) {
    const rec = await this.svc.getRecording(id);
    if (!rec.storagePath) return res.status(404).json({ error: 'NO_FILE' });
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${id}.mp4"`);
    return res.sendFile(rec.storagePath);
  }
}
