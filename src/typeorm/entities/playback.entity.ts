// ============================================================================
// PLAYBACK ENTITY
// ============================================================================
// Mục đích: Lưu trữ thông tin session playback video đã ghi (recordings)
// 
// Luồng nghiệp vụ:
// 1. User request playback một recording cụ thể
// 2. Hệ thống tạo playback session với URL stream (HLS/DASH)
// 3. Track thời gian bắt đầu/kết thúc, người dùng, recording source
// 4. Hỗ trợ tua (seek), pause/resume thông qua timestamps
// 
// Quan hệ:
// - playback (N) -> recording (1): Một recording có thể playback nhiều lần
// - playback (N) -> camera (1): Track camera nguồn (cascade delete)
// - playback (N) -> user: Track user đã xem (optional, dùng audit)
// ============================================================================

import { 
  Column, 
  CreateDateColumn, 
  Entity, 
  ManyToOne, 
  PrimaryGeneratedColumn, 
  JoinColumn,
  UpdateDateColumn 
} from 'typeorm';

// Tương thích với test environment (SQLite dùng datetime thay vì timestamptz)
const dateType = process.env.NODE_ENV === 'test' ? 'datetime' : 'timestamptz';

import { Camera } from './camera.entity';
import { Recording } from './recording.entity';

// ----------------------------------------------------------------------------
// PLAYBACK STATUS
// ----------------------------------------------------------------------------
// PENDING    : Session vừa tạo, chưa bắt đầu stream
// PLAYING    : Đang phát video
// PAUSED     : Tạm dừng (có thể resume)
// STOPPED    : User dừng hoặc hết video
// COMPLETED  : Xem xong toàn bộ recording
// FAILED     : Lỗi khi tạo stream hoặc file không tồn tại
// ----------------------------------------------------------------------------
export type PlaybackStatus = 
  | 'PENDING' 
  | 'PLAYING' 
  | 'PAUSED' 
  | 'STOPPED' 
  | 'COMPLETED' 
  | 'FAILED';

// ----------------------------------------------------------------------------
// PLAYBACK PROTOCOL
// ----------------------------------------------------------------------------
// HLS        : HTTP Live Streaming (m3u8) - tốt cho web/mobile
// DASH       : Dynamic Adaptive Streaming over HTTP (mpd)
// RTSP       : Real-Time Streaming Protocol (low latency, native)
// HTTP_MP4   : Direct HTTP download/progressive (simple, no adaptive)
// ----------------------------------------------------------------------------
export type PlaybackProtocol = 'HLS' | 'DASH' | 'RTSP' | 'HTTP_MP4';

// ============================================================================
// PLAYBACK ENTITY
// ============================================================================
@Entity({ name: 'playbacks' })
export class Playback {
  // --------------------------------------------------------------------------
  // PRIMARY KEY
  // --------------------------------------------------------------------------
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // --------------------------------------------------------------------------
  // FOREIGN KEYS
  // --------------------------------------------------------------------------
  
  // Quan hệ với Recording (N-1): Playback phát từ file recording đã ghi
  // CASCADE DELETE: Khi recording bị xóa -> xóa luôn playback sessions
  @ManyToOne(() => Recording, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recording_id' })
  recording: Recording;

  // Quan hệ với Camera (N-1): Track camera nguồn (để filter, analytics)
  // CASCADE DELETE: Khi camera bị xóa -> xóa luôn playback history
  @ManyToOne(() => Camera, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'camera_id' })
  camera: Camera;

  // --------------------------------------------------------------------------
  // PLAYBACK SESSION INFO
  // --------------------------------------------------------------------------
  
  // URL stream để client phát (HLS: .m3u8, DASH: .mpd, HTTP: .mp4)
  // Ví dụ: "http://localhost:8080/playback/<id>/index.m3u8"
  @Column({ name: 'stream_url', type: 'varchar', length: 500, nullable: true })
  streamUrl?: string | null;

  // Protocol sử dụng (HLS/DASH/RTSP/HTTP_MP4)
  @Column({ name: 'protocol', type: 'varchar', length: 20, default: 'HLS' })
  protocol: PlaybackProtocol;

  // Trạng thái playback (PENDING/PLAYING/PAUSED/STOPPED/COMPLETED/FAILED)
  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  status: PlaybackStatus;

  // --------------------------------------------------------------------------
  // PLAYBACK POSITION & TIMING
  // --------------------------------------------------------------------------
  
  // Vị trí hiện tại trong video (giây) - cho tính năng resume/seek
  // NULL = chưa bắt đầu, 0 = đầu video
  @Column({ name: 'current_position_sec', type: 'int', nullable: true, default: 0 })
  currentPositionSec?: number | null;

  // Thời gian bắt đầu playback session
  @Column({ name: 'started_at', type: dateType as any, nullable: true })
  startedAt?: Date | null;

  // Thời gian kết thúc playback (completed/stopped/failed)
  @Column({ name: 'ended_at', type: dateType as any, nullable: true })
  endedAt?: Date | null;

  // --------------------------------------------------------------------------
  // USER TRACKING (OPTIONAL)
  // --------------------------------------------------------------------------
  
  // User ID đã xem (dùng cho audit, analytics) - nullable vì có thể không track
  // Note: Không dùng FK vì users table không quan hệ trực tiếp playback
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId?: string | null;

  // Username snapshot (để audit khi user bị xóa vẫn biết ai đã xem)
  @Column({ name: 'username', type: 'varchar', length: 100, nullable: true })
  username?: string | null;

  // --------------------------------------------------------------------------
  // ERROR TRACKING
  // --------------------------------------------------------------------------
  
  // Lỗi nếu status = FAILED (file not found, transcoding error, etc.)
  @Column({ name: 'error_message', type: 'varchar', length: 500, nullable: true })
  errorMessage?: string | null;

  // --------------------------------------------------------------------------
  // METADATA & AUDIT
  // --------------------------------------------------------------------------
  
  // User Agent của client (browser/app) - dùng cho analytics
  @Column({ name: 'user_agent', type: 'varchar', length: 500, nullable: true })
  userAgent?: string | null;

  // IP address của client
  @Column({ name: 'client_ip', type: 'varchar', length: 100, nullable: true })
  clientIp?: string | null;

  // Thời gian tạo record
  @CreateDateColumn({ name: 'created_at', type: dateType as any })
  createdAt: Date;

  // Thời gian cập nhật cuối (khi update position, status)
  @UpdateDateColumn({ name: 'updated_at', type: dateType as any })
  updatedAt: Date;
}
