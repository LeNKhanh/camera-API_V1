// ============================================================================
// PLAYBACK SERVICE
// ============================================================================
// Mục đích: Quản lý session phát lại video đã ghi (recordings)
// 
// Nghiệp vụ chính:
// 1. CREATE: Tạo playback session từ recording
// 2. LIST: Danh sách playback sessions (filter theo recording/camera/user/status)
// 3. GET: Chi tiết playback session
// 4. UPDATE_POSITION: Cập nhật vị trí hiện tại (seek, resume)
// 5. UPDATE_STATUS: Chuyển trạng thái (play/pause/stop)
// 6. DELETE: Xóa playback session
// 7. ANALYTICS: Thống kê lượt xem
// 
// Luồng tạo playback:
// 1. Kiểm tra recording tồn tại và COMPLETED
// 2. Kiểm tra file video tồn tại
// 3. Tạo stream URL (HLS/DASH/HTTP_MP4) hoặc dùng file trực tiếp
// 4. Lưu session với status PENDING
// 5. Trả về URL để client phát
// 
// Tính năng mở rộng:
// - Transcoding on-the-fly (ffmpeg)
// - Adaptive bitrate streaming
// - DRM protection
// - Analytics (watch duration, completion rate)
// ============================================================================

import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { existsSync } from 'fs';
import { Request } from 'express';

import { Playback, PlaybackStatus, PlaybackProtocol } from '../../typeorm/entities/playback.entity';
import { Recording } from '../../typeorm/entities/recording.entity';
import { Camera } from '../../typeorm/entities/camera.entity';

// ============================================================================
// DTOs (Data Transfer Objects)
// ============================================================================

// DTO: Tạo playback session
export interface CreatePlaybackDto {
  recordingId: string;              // ID của recording cần phát
  protocol?: PlaybackProtocol;      // HLS/DASH/RTSP/HTTP_MP4 (default: HLS)
  startPositionSec?: number;        // Bắt đầu từ giây thứ X (default: 0)
}

// DTO: Cập nhật vị trí playback (seek/resume)
export interface UpdatePlaybackPositionDto {
  currentPositionSec: number;       // Vị trí hiện tại (giây)
}

// DTO: Cập nhật trạng thái playback
export interface UpdatePlaybackStatusDto {
  status: PlaybackStatus;           // PLAYING/PAUSED/STOPPED/COMPLETED
}

// DTO: Filter danh sách playback
export interface ListPlaybackDto {
  recordingId?: string;             // Filter theo recording
  cameraId?: string;                // Filter theo camera
  userId?: string;                  // Filter theo user
  status?: PlaybackStatus;          // Filter theo trạng thái
  from?: string;                    // Filter từ thời gian (ISO8601)
  to?: string;                      // Filter đến thời gian (ISO8601)
  page?: number;                    // Trang hiện tại (default: 1)
  pageSize?: number;                // Số record/trang (default: 20)
}

// ============================================================================
// PLAYBACK SERVICE
// ============================================================================
@Injectable()
export class PlaybackService {
  constructor(
    @InjectRepository(Playback)
    private readonly playbackRepo: Repository<Playback>,
    
    @InjectRepository(Recording)
    private readonly recordingRepo: Repository<Recording>,
    
    @InjectRepository(Camera)
    private readonly cameraRepo: Repository<Camera>,
  ) {}

  // ==========================================================================
  // CREATE PLAYBACK SESSION
  // ==========================================================================
  // Tạo session playback mới từ recording đã ghi
  // 
  // Flow:
  // 1. Validate recording tồn tại và COMPLETED
  // 2. Validate file video tồn tại trên disk
  // 3. Generate stream URL theo protocol
  // 4. Track user info từ request (audit/analytics)
  // 5. Tạo playback session với status PENDING
  // 6. Trả về playback info + stream URL
  // ==========================================================================
  async create(dto: CreatePlaybackDto, req?: Request): Promise<Playback> {
    // ------------------------------------------------------------------------
    // STEP 1: Validate recording
    // ------------------------------------------------------------------------
    const recording = await this.recordingRepo.findOne({
      where: { id: dto.recordingId },
      relations: ['camera'],
    });

    if (!recording) {
      throw new NotFoundException(`Recording with ID ${dto.recordingId} not found`);
    }

    // Chỉ cho phép playback recording đã hoàn tất
    if (recording.status !== 'COMPLETED') {
      throw new BadRequestException(
        `Cannot playback recording with status ${recording.status}. ` +
        `Only COMPLETED recordings can be played back.`
      );
    }

    // ------------------------------------------------------------------------
    // STEP 2: Validate file tồn tại
    // ------------------------------------------------------------------------
    if (!existsSync(recording.storagePath)) {
      throw new NotFoundException(
        `Recording file not found at ${recording.storagePath}. ` +
        `The file may have been deleted or moved.`
      );
    }

    // ------------------------------------------------------------------------
    // STEP 3: Generate stream URL theo protocol
    // ------------------------------------------------------------------------
    const protocol = dto.protocol || 'HLS';
    const streamUrl = this.generateStreamUrl(recording, protocol);

    // ------------------------------------------------------------------------
    // STEP 4: Extract user info từ request (nếu có)
    // ------------------------------------------------------------------------
    const user = req?.['user'] as { id?: string; username?: string } | undefined;
    const userId = user?.id || null;
    const username = user?.username || null;
    const userAgent = req?.headers['user-agent'] || null;
    const clientIp = this.extractClientIp(req);

    // ------------------------------------------------------------------------
    // STEP 5: Tạo playback session
    // ------------------------------------------------------------------------
    const playback = this.playbackRepo.create({
      recording,
      camera: recording.camera,
      streamUrl,
      protocol,
      status: 'PENDING',
      currentPositionSec: dto.startPositionSec || 0,
      startedAt: null, // Sẽ set khi client bắt đầu phát
      userId,
      username,
      userAgent,
      clientIp,
    });

    const saved = await this.playbackRepo.save(playback);

    // ------------------------------------------------------------------------
    // STEP 6: Trả về với relations đầy đủ
    // ------------------------------------------------------------------------
    return this.playbackRepo.findOne({
      where: { id: saved.id },
      relations: ['recording', 'camera'],
    });
  }

  // ==========================================================================
  // LIST PLAYBACK SESSIONS (với filter + pagination)
  // ==========================================================================
  async list(filter: ListPlaybackDto = {}): Promise<{
    data: Playback[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const page = filter.page || 1;
    const pageSize = Math.min(filter.pageSize || 20, 100); // Max 100
    const skip = (page - 1) * pageSize;

    // ------------------------------------------------------------------------
    // Build WHERE clause động
    // ------------------------------------------------------------------------
    const where: any = {};

    if (filter.recordingId) {
      where.recording = { id: filter.recordingId };
    }

    if (filter.cameraId) {
      where.camera = { id: filter.cameraId };
    }

    if (filter.userId) {
      where.userId = filter.userId;
    }

    if (filter.status) {
      where.status = filter.status;
    }

    // Time range filter
    if (filter.from || filter.to) {
      const from = filter.from ? new Date(filter.from) : new Date(0);
      const to = filter.to ? new Date(filter.to) : new Date();
      where.createdAt = Between(from, to);
    }

    // ------------------------------------------------------------------------
    // Query với pagination
    // ------------------------------------------------------------------------
    const [data, total] = await this.playbackRepo.findAndCount({
      where,
      relations: ['recording', 'camera'],
      order: { createdAt: 'DESC' },
      skip,
      take: pageSize,
    });

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // ==========================================================================
  // GET PLAYBACK SESSION BY ID
  // ==========================================================================
  async get(id: string): Promise<Playback> {
    const playback = await this.playbackRepo.findOne({
      where: { id },
      relations: ['recording', 'camera'],
    });

    if (!playback) {
      throw new NotFoundException(`Playback session ${id} not found`);
    }

    return playback;
  }

  // ==========================================================================
  // UPDATE PLAYBACK POSITION (seek/resume)
  // ==========================================================================
  // Client gọi API này để update vị trí hiện tại khi:
  // - User tua video (seek)
  // - Client định kỳ update position (heartbeat) để track watch duration
  // ==========================================================================
  async updatePosition(id: string, dto: UpdatePlaybackPositionDto): Promise<Playback> {
    const playback = await this.get(id);

    // Validate position không vượt quá duration của recording
    if (dto.currentPositionSec < 0) {
      throw new BadRequestException('Position cannot be negative');
    }

    if (playback.recording.durationSec && dto.currentPositionSec > playback.recording.durationSec) {
      throw new BadRequestException(
        `Position ${dto.currentPositionSec}s exceeds recording duration ${playback.recording.durationSec}s`
      );
    }

    // Auto-update status thành PLAYING nếu đang PENDING
    const updates: Partial<Playback> = {
      currentPositionSec: dto.currentPositionSec,
    };

    if (playback.status === 'PENDING') {
      updates.status = 'PLAYING';
      updates.startedAt = new Date();
    }

    // Auto-complete nếu đã xem hết video (position >= 95% duration)
    if (playback.recording.durationSec) {
      const completionThreshold = playback.recording.durationSec * 0.95;
      if (dto.currentPositionSec >= completionThreshold && playback.status === 'PLAYING') {
        updates.status = 'COMPLETED';
        updates.endedAt = new Date();
      }
    }

    await this.playbackRepo.update(id, updates as any);
    return this.get(id);
  }

  // ==========================================================================
  // UPDATE PLAYBACK STATUS (play/pause/stop)
  // ==========================================================================
  async updateStatus(id: string, newStatus: 'PLAYING' | 'PAUSED' | 'STOPPED'): Promise<Playback> {
    const playback = await this.get(id);

    // Không cho thay đổi nếu đã ở trạng thái kết thúc / lỗi
    if (['COMPLETED', 'FAILED'].includes(playback.status)) {
      throw new BadRequestException(`Playback already finalized with status ${playback.status}`);
    }

    if (playback.status === newStatus) {
      return playback; // Idempotent
    }

    const updates: Partial<Playback> = { status: newStatus };

    if (newStatus === 'PLAYING' && !playback.startedAt) {
      updates.startedAt = new Date();
    }

    if (newStatus === 'STOPPED') {
      updates.endedAt = new Date();
    }

    await this.playbackRepo.update(id, updates as any);
    return this.get(id);
  }

  // ==========================================================================
  // DELETE PLAYBACK SESSION
  // ==========================================================================
  async delete(id: string): Promise<{ ok: boolean; message: string }> {
    const playback = await this.get(id);
    await this.playbackRepo.remove(playback);
    return {
      ok: true,
      message: `Playback session ${id} deleted successfully`,
    };
  }

  // ==========================================================================
  // ANALYTICS: Thống kê playback
  // ==========================================================================
  async getAnalytics(filter: {
    recordingId?: string;
    cameraId?: string;
    from?: string;
    to?: string;
  }): Promise<{
    totalSessions: number;
    completedSessions: number;
    averageWatchDuration: number;
    completionRate: number;
    uniqueUsers: number;
  }> {
    const where: any = {};

    if (filter.recordingId) {
      where.recording = { id: filter.recordingId };
    }

    if (filter.cameraId) {
      where.camera = { id: filter.cameraId };
    }

    if (filter.from || filter.to) {
      const from = filter.from ? new Date(filter.from) : new Date(0);
      const to = filter.to ? new Date(filter.to) : new Date();
      where.createdAt = Between(from, to);
    }

    const sessions = await this.playbackRepo.find({ where });

    const totalSessions = sessions.length;
    const completedSessions = sessions.filter(s => s.status === 'COMPLETED').length;
    const completionRate = totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0;

    // Average watch duration (giây)
    const watchDurations = sessions
      .filter(s => s.startedAt && s.endedAt)
      .map(s => (s.endedAt!.getTime() - s.startedAt!.getTime()) / 1000);
    const averageWatchDuration = watchDurations.length > 0
      ? watchDurations.reduce((sum, d) => sum + d, 0) / watchDurations.length
      : 0;

    // Unique users
    const uniqueUserIds = new Set(sessions.filter(s => s.userId).map(s => s.userId));
    const uniqueUsers = uniqueUserIds.size;

    return {
      totalSessions,
      completedSessions,
      averageWatchDuration: Math.round(averageWatchDuration),
      completionRate: Math.round(completionRate * 100) / 100,
      uniqueUsers,
    };
  }

  // ==========================================================================
  // HELPER: Generate stream URL
  // ==========================================================================
  // Tạo URL stream theo protocol
  // 
  // HLS: http://localhost:8080/playback/<id>/index.m3u8
  // DASH: http://localhost:8080/playback/<id>/manifest.mpd
  // HTTP_MP4: http://localhost:3000/playbacks/<id>/download
  // RTSP: rtsp://localhost:8554/playback/<id>
  // ==========================================================================
  private generateStreamUrl(recording: Recording, protocol: PlaybackProtocol): string {
    const baseUrl = process.env.STREAM_BASE_URL || 'http://localhost:8080';
    const apiUrl = process.env.API_BASE_URL || 'http://localhost:3000';

    switch (protocol) {
      case 'HLS':
        return `${baseUrl}/playback/${recording.id}/index.m3u8`;

      case 'DASH':
        return `${baseUrl}/playback/${recording.id}/manifest.mpd`;

      case 'HTTP_MP4':
        return `${apiUrl}/playbacks/${recording.id}/download`;

      case 'RTSP':
        return `rtsp://localhost:8554/playback/${recording.id}`;

      default:
        return `${baseUrl}/playback/${recording.id}/index.m3u8`;
    }
  }

  // ==========================================================================
  // HELPER: Extract client IP
  // ==========================================================================
  private extractClientIp(req?: Request): string | null {
    if (!req) return null;

    // Ưu tiên X-Forwarded-For (khi có proxy/load balancer)
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const ips = (forwarded as string).split(',');
      return ips[0].trim();
    }

    // Fallback: X-Real-IP header
    const realIp = req.headers['x-real-ip'];
    if (realIp) {
      return realIp as string;
    }

    // Fallback: req.ip
    return req.ip || null;
  }
}
