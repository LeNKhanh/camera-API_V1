// ============================================================================
// PLAYBACK CONTROLLER - EVENT-TRIGGERED RECORDING
// ============================================================================
// RESTful API endpoints để quản lý playbacks (event-triggered recordings)
// 
// Endpoints:
// GET    /playbacks                    - Danh sách playbacks (filter + pagination)
// GET    /playbacks/:id                - Chi tiết playback
// DELETE /playbacks/:id                - Xóa playback + video trên R2
// POST   /playbacks/:id/stop           - Manual stop recording (nếu cần)
// 
// Phân quyền:
// - ADMIN: Toàn quyền
// - OPERATOR: Toàn quyền
// - VIEWER: Chỉ xem (GET)
// 
// Note: Playback creation là tự động khi event được tạo
// ============================================================================

import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsEnum, IsInt, IsOptional, IsPositive, IsUUID, Min } from 'class-validator';

import { PlaybackService } from './playback.service';
import { JwtAuthGuard } from '../guards/jwt.guard';
import { RolesGuard } from '../../common/roles.guard';
import { Roles } from '../../common/roles.decorator';
import { RecordingStatus } from '../../typeorm/entities/playback.entity';

// ============================================================================
// DTOs
// ============================================================================

// ----------------------------------------------------------------------------
// DTO: Query params cho list
// ----------------------------------------------------------------------------
class ListPlaybackQueryDto {
  @IsOptional()
  @IsUUID()
  eventId?: string;

  @IsOptional()
  @IsUUID()
  cameraId?: string;

  @IsOptional()
  @IsEnum(['PENDING', 'RECORDING', 'PROCESSING', 'COMPLETED', 'FAILED'])
  recordingStatus?: RecordingStatus;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  pageSize?: number;
}

// ============================================================================
// CONTROLLER
// ============================================================================
@Controller('playbacks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PlaybackController {
  constructor(private readonly svc: PlaybackService) {}

  // ==========================================================================
  // LIST PLAYBACKS
  // ==========================================================================
  // GET /playbacks?eventId=xxx&recordingStatus=COMPLETED
  // ==========================================================================
  @Get()
  @Roles('ADMIN', 'OPERATOR', 'VIEWER')
  list(@Query() query: ListPlaybackQueryDto) {
    return this.svc.list({
      eventId: query.eventId,
      cameraId: query.cameraId,
      recordingStatus: query.recordingStatus,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  // ==========================================================================
  // GET PLAYBACK BY ID
  // ==========================================================================
  // GET /playbacks/:id
  // ==========================================================================
  @Get(':id')
  @Roles('ADMIN', 'OPERATOR', 'VIEWER')
  get(@Param('id') id: string) {
    return this.svc.get(id);
  }

  // ==========================================================================
  // DELETE PLAYBACK
  // ==========================================================================
  // DELETE /playbacks/:id
  // Xóa playback record + video trên R2
  // ==========================================================================
  @Delete(':id')
  @Roles('ADMIN', 'OPERATOR')
  remove(@Param('id') id: string) {
    return this.svc.delete(id);
  }

  // ==========================================================================
  // MANUAL STOP RECORDING
  // ==========================================================================
  // POST /playbacks/:id/stop
  // Dừng recording thủ công (nếu muốn dừng trước khi event end)
  // ==========================================================================
  @Post(':id/stop')
  @Roles('ADMIN', 'OPERATOR')
  manualStop(@Param('id') id: string) {
    return this.svc.manualStopRecording(id);
  }
}
