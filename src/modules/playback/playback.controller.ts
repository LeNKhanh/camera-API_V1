// ============================================================================
// PLAYBACK CONTROLLER
// ============================================================================
// RESTful API endpoints để quản lý playback sessions
// 
// Endpoints:
// POST   /playbacks                    - Tạo playback session mới
// GET    /playbacks                    - Danh sách playbacks (filter + pagination)
// GET    /playbacks/:id                - Chi tiết playback session
// PATCH  /playbacks/:id/position       - Cập nhật vị trí hiện tại (seek/resume)
// PATCH  /playbacks/:id/status         - Cập nhật trạng thái (play/pause/stop)
// DELETE /playbacks/:id                - Xóa playback session
// GET    /playbacks/analytics          - Thống kê playback
// GET    /playbacks/:id/download       - Download file MP4 (HTTP_MP4 protocol)
// 
// Phân quyền:
// - ADMIN: Toàn quyền
// - OPERATOR: Toàn quyền
// - VIEWER: Chỉ xem (GET), không tạo/update/delete
// ============================================================================

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  StreamableFile,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { createReadStream, statSync } from 'fs';
import { IsEnum, IsInt, IsOptional, IsPositive, IsString, IsUUID, Min } from 'class-validator';

import { PlaybackService } from './playback.service';
import { JwtAuthGuard } from '../guards/jwt.guard';
import { RolesGuard } from '../../common/roles.guard';
import { Roles } from '../../common/roles.decorator';
import { PlaybackStatus, PlaybackProtocol } from '../../typeorm/entities/playback.entity';
import { UpdatePlaybackStatusDto, PlaybackManualStatus } from './dto/update-playback-status.dto';

// ============================================================================
// DTOs with Validation
// ============================================================================

// ----------------------------------------------------------------------------
// DTO: Tạo playback session
// ----------------------------------------------------------------------------
class CreatePlaybackDto {
  @IsUUID()
  recordingId: string;

  @IsOptional()
  @IsEnum(['HLS', 'DASH', 'RTSP', 'HTTP_MP4'])
  protocol?: PlaybackProtocol;

  @IsOptional()
  @IsInt()
  @Min(0)
  startPositionSec?: number;
}

// ----------------------------------------------------------------------------
// DTO: Cập nhật position
// ----------------------------------------------------------------------------
class UpdatePlaybackPositionDto {
  @IsInt()
  @Min(0)
  currentPositionSec: number;
}

// (Moved UpdatePlaybackStatusDto to dedicated file dto/update-playback-status.dto.ts)

// ----------------------------------------------------------------------------
// DTO: Query params cho list
// ----------------------------------------------------------------------------
class ListPlaybackQueryDto {
  @IsOptional()
  @IsUUID()
  recordingId?: string;

  @IsOptional()
  @IsUUID()
  cameraId?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsEnum(['PENDING', 'PLAYING', 'PAUSED', 'STOPPED', 'COMPLETED', 'FAILED'])
  status?: PlaybackStatus;

  @IsOptional()
  @IsString()
  from?: string; // ISO8601

  @IsOptional()
  @IsString()
  to?: string; // ISO8601

  @IsOptional()
  @IsInt()
  @IsPositive()
  page?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  pageSize?: number;
}

// ----------------------------------------------------------------------------
// DTO: Query params cho analytics
// ----------------------------------------------------------------------------
class AnalyticsQueryDto {
  @IsOptional()
  @IsUUID()
  recordingId?: string;

  @IsOptional()
  @IsUUID()
  cameraId?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}

// ============================================================================
// PLAYBACK CONTROLLER
// ============================================================================
@Controller('playbacks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PlaybackController {
  constructor(private readonly svc: PlaybackService) {}

  // ==========================================================================
  // POST /playbacks - Tạo playback session mới
  // ==========================================================================
  // Tạo session để phát lại recording đã ghi
  // 
  // Request body:
  // {
  //   "recordingId": "<uuid>",
  //   "protocol": "HLS",        // optional: HLS/DASH/RTSP/HTTP_MP4
  //   "startPositionSec": 0     // optional: bắt đầu từ giây thứ X
  // }
  // 
  // Response:
  // {
  //   "id": "<uuid>",
  //   "streamUrl": "http://localhost:8080/playback/<id>/index.m3u8",
  //   "protocol": "HLS",
  //   "status": "PENDING",
  //   "recording": { ... },
  //   "camera": { ... },
  //   ...
  // }
  // 
  // Quyền: ADMIN, OPERATOR, VIEWER
  // ==========================================================================
  @Post()
  @Roles('ADMIN', 'OPERATOR', 'VIEWER')
  async create(@Body() dto: CreatePlaybackDto, @Req() req: Request) {
    return this.svc.create(dto, req);
  }

  // ==========================================================================
  // GET /playbacks - Danh sách playback sessions
  // ==========================================================================
  // Lấy danh sách playbacks với filter và pagination
  // 
  // Query params:
  // - recordingId: Filter theo recording
  // - cameraId: Filter theo camera
  // - userId: Filter theo user
  // - status: Filter theo trạng thái (PENDING/PLAYING/...)
  // - from: Filter từ thời gian (ISO8601)
  // - to: Filter đến thời gian (ISO8601)
  // - page: Trang hiện tại (default: 1)
  // - pageSize: Số records/trang (default: 20, max: 100)
  // 
  // Response:
  // {
  //   "data": [ ... ],
  //   "total": 100,
  //   "page": 1,
  //   "pageSize": 20,
  //   "totalPages": 5
  // }
  // 
  // Quyền: ADMIN, OPERATOR, VIEWER
  // ==========================================================================
  @Get()
  @Roles('ADMIN', 'OPERATOR', 'VIEWER')
  async list(@Query() query: ListPlaybackQueryDto) {
    return this.svc.list({
      recordingId: query.recordingId,
      cameraId: query.cameraId,
      userId: query.userId,
      status: query.status,
      from: query.from,
      to: query.to,
      page: query.page ? parseInt(String(query.page), 10) : 1,
      pageSize: query.pageSize ? parseInt(String(query.pageSize), 10) : 20,
    });
  }

  // ==========================================================================
  // GET /playbacks/analytics - Thống kê playback
  // ==========================================================================
  // Lấy thống kê về playback sessions (analytics dashboard)
  // 
  // Query params:
  // - recordingId: Filter theo recording
  // - cameraId: Filter theo camera
  // - from: Từ thời gian
  // - to: Đến thời gian
  // 
  // Response:
  // {
  //   "totalSessions": 150,
  //   "completedSessions": 120,
  //   "averageWatchDuration": 180,  // seconds
  //   "completionRate": 80.0,        // percent
  //   "uniqueUsers": 45
  // }
  // 
  // Quyền: ADMIN, OPERATOR
  // ==========================================================================
  @Get('analytics')
  @Roles('ADMIN', 'OPERATOR')
  async getAnalytics(@Query() query: AnalyticsQueryDto) {
    return this.svc.getAnalytics({
      recordingId: query.recordingId,
      cameraId: query.cameraId,
      from: query.from,
      to: query.to,
    });
  }

  // ==========================================================================
  // GET /playbacks/:id - Chi tiết playback session
  // ==========================================================================
  // Lấy thông tin chi tiết của playback session
  // 
  // Response: Playback entity với relations (recording, camera)
  // 
  // Quyền: ADMIN, OPERATOR, VIEWER
  // ==========================================================================
  @Get(':id')
  @Roles('ADMIN', 'OPERATOR', 'VIEWER')
  async get(@Param('id') id: string) {
    return this.svc.get(id);
  }

  // ==========================================================================
  // PATCH /playbacks/:id/position - Cập nhật position (seek/resume)
  // ==========================================================================
  // Client gọi API này để:
  // - Báo vị trí hiện tại (heartbeat) để track watch duration
  // - Seek (tua) đến vị trí mới
  // - Resume từ vị trí đã dừng
  // 
  // Request body:
  // {
  //   "currentPositionSec": 120  // Vị trí hiện tại (giây)
  // }
  // 
  // Tự động:
  // - Chuyển status PENDING -> PLAYING khi update position lần đầu
  // - Chuyển status PLAYING -> COMPLETED khi xem hết (>=95% duration)
  // 
  // Quyền: ADMIN, OPERATOR, VIEWER
  // ==========================================================================
  @Patch(':id/position')
  @Roles('ADMIN', 'OPERATOR', 'VIEWER')
  async updatePosition(
    @Param('id') id: string,
    @Body() dto: UpdatePlaybackPositionDto,
  ) {
    return this.svc.updatePosition(id, dto);
  }

  // ==========================================================================
  // PATCH /playbacks/:id/status - Cập nhật status
  // ==========================================================================
  // Client gọi API này để thay đổi trạng thái:
  // - PLAYING: Bắt đầu/tiếp tục phát
  // - PAUSED: Tạm dừng
  // - STOPPED: Dừng hẳn (user action)
  // - COMPLETED: Xem xong (thường auto-set khi position >= 95%)
  // - FAILED: Lỗi khi phát (network, codec, etc.)
  // 
  // Request body:
  // {
  //   "status": "PAUSED"
  // }
  // 
  // Quyền: ADMIN, OPERATOR, VIEWER
  // ==========================================================================
  @Patch(':id/status')
  @Roles('ADMIN', 'OPERATOR', 'VIEWER')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdatePlaybackStatusDto,
  ) {
    // Debug log để kiểm tra giá trị thực tế nhận từ client
    // (Có thể remove sau khi ổn định)
    // eslint-disable-next-line no-console
    console.log('[PATCH /playbacks/:id/status] dto.status =', JSON.stringify(dto.status));
    return this.svc.updateStatus(id, dto.status as PlaybackManualStatus);
  }

  // ==========================================================================
  // GET /playbacks/:id/download - Download file MP4
  // ==========================================================================
  // Download file recording dưới dạng HTTP_MP4 (progressive download)
  // 
  // Hỗ trợ:
  // - Range requests (video seeking trong browser)
  // - Content-Type: video/mp4
  // - Content-Disposition: attachment (force download)
  // 
  // Quyền: ADMIN, OPERATOR, VIEWER
  // ==========================================================================
  @Get(':id/download')
  @Roles('ADMIN', 'OPERATOR', 'VIEWER')
  async download(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    const playback = await this.svc.get(id);
    const filePath = playback.recording.storagePath;

    // Check file tồn tại
    try {
      const stat = statSync(filePath);
      const fileSize = stat.size;

      // Parse Range header (cho video seeking)
      const range = req.headers.range;

      if (range) {
        // Partial content (HTTP 206)
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = end - start + 1;

        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': 'video/mp4',
        });

        const stream = createReadStream(filePath, { start, end });
        stream.pipe(res);
      } else {
        // Full content (HTTP 200)
        res.writeHead(200, {
          'Content-Length': fileSize,
          'Content-Type': 'video/mp4',
          'Content-Disposition': `attachment; filename="${playback.recording.id}.mp4"`,
        });

        const stream = createReadStream(filePath);
        stream.pipe(res);
      }
    } catch (error) {
      res.status(404).json({
        statusCode: 404,
        message: 'Recording file not found',
        error: 'Not Found',
      });
    }
  }

  // ==========================================================================
  // DELETE /playbacks/:id - Xóa playback session
  // ==========================================================================
  // Xóa playback session (không xóa recording, chỉ xóa session)
  // 
  // Use case:
  // - Cleanup old playback sessions
  // - User muốn xóa lịch sử xem
  // 
  // Response:
  // {
  //   "ok": true,
  //   "message": "Playback session deleted successfully"
  // }
  // 
  // Quyền: ADMIN, OPERATOR
  // ==========================================================================
  @Delete(':id')
  @Roles('ADMIN', 'OPERATOR')
  async delete(@Param('id') id: string) {
    return this.svc.delete(id);
  }
}
