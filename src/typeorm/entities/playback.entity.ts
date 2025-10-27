// ============================================================================
// PLAYBACK ENTITY - EVENT-TRIGGERED RECORDING
// ============================================================================
// Mục đích: Event-driven recording - Tự động record khi nhận event
// 
// Luồng nghiệp vụ MỚI:
// 1. Khi Event được tạo (MOTION/ALERT) → Auto-start recording
// 2. Playback record được tạo với status RECORDING
// 3. FFmpeg record real-time từ camera RTSP
// 4. Khi Event kết thúc → Stop recording + Upload R2
// 5. Playback status → COMPLETED với video_url (public R2)
// 
// Quan hệ:
// - playback (N) -> event (1): Một event trigger một recording session
// - playback (N) -> camera (1): Track camera nguồn (cascade delete)
// 
// Recording Status Lifecycle:
// PENDING → RECORDING → PROCESSING → COMPLETED/FAILED
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
import { Event } from './event.entity';

// ----------------------------------------------------------------------------
// RECORDING STATUS
// ----------------------------------------------------------------------------
// PENDING    : Playback vừa tạo, chờ bắt đầu recording
// RECORDING  : Đang record real-time từ camera
// PROCESSING : Đã stop record, đang upload lên R2
// COMPLETED  : Video đã upload xong, có video_url
// FAILED     : Lỗi trong quá trình record/upload
// ----------------------------------------------------------------------------
export type RecordingStatus = 
  | 'PENDING' 
  | 'RECORDING' 
  | 'PROCESSING'
  | 'COMPLETED' 
  | 'FAILED';

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
  
  // Quan hệ với Event (N-1): Event trigger recording
  // SET NULL: Khi event bị xóa -> playback vẫn giữ lại (orphan video)
  @ManyToOne(() => Event, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'event_id' })
  event?: Event | null;

  // Quan hệ với Camera (N-1): Track camera nguồn
  // CASCADE DELETE: Khi camera bị xóa -> xóa luôn playback history
  @ManyToOne(() => Camera, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'camera_id' })
  camera: Camera;

  // --------------------------------------------------------------------------
  // RECORDING INFO
  // --------------------------------------------------------------------------
  
  // Trạng thái recording (PENDING/RECORDING/PROCESSING/COMPLETED/FAILED)
  @Column({ name: 'recording_status', type: 'varchar', length: 20, default: 'PENDING' })
  recordingStatus: RecordingStatus;

  // URL public trên R2 (sau khi upload xong)
  @Column({ name: 'video_url', type: 'varchar', length: 500, nullable: true })
  videoUrl?: string | null;

  // Path local tạm (trước khi upload R2)
  @Column({ name: 'local_path', type: 'varchar', length: 500, nullable: true })
  localPath?: string | null;

  // --------------------------------------------------------------------------
  // VIDEO METADATA
  // --------------------------------------------------------------------------
  
  // Kích thước file (bytes)
  @Column({ name: 'file_size_bytes', type: 'bigint', nullable: true })
  fileSizeBytes?: number | null;

  // Thời lượng video (giây)
  @Column({ name: 'duration_sec', type: 'int', nullable: true })
  durationSec?: number | null;

  // Codec (H.264, H.265)
  @Column({ name: 'codec', type: 'varchar', length: 20, nullable: true })
  codec?: string | null;

  // Resolution (1080p, 720p, etc.)
  @Column({ name: 'resolution', type: 'varchar', length: 20, nullable: true })
  resolution?: string | null;

  // --------------------------------------------------------------------------
  // TIMESTAMPS
  // --------------------------------------------------------------------------
  
  // Thời gian bắt đầu recording
  @Column({ name: 'started_at', type: dateType as any, nullable: true })
  startedAt?: Date | null;

  // Thời gian kết thúc recording
  @Column({ name: 'ended_at', type: dateType as any, nullable: true })
  endedAt?: Date | null;

  // Thời gian tạo record
  @CreateDateColumn({ name: 'created_at', type: dateType as any })
  createdAt: Date;

  // Thời gian cập nhật cuối
  @UpdateDateColumn({ name: 'updated_at', type: dateType as any })
  updatedAt: Date;

  // --------------------------------------------------------------------------
  // ERROR TRACKING
  // --------------------------------------------------------------------------
  
  // Message lỗi nếu status = FAILED
  @Column({ name: 'error_message', type: 'varchar', length: 500, nullable: true })
  errorMessage?: string | null;
}
