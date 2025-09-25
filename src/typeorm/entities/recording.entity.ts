// Entity Recording: lưu thông tin file ghi, thời lượng, trạng thái
import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, JoinColumn } from 'typeorm';
import { Camera } from './camera.entity';

export type RecordingStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

// Bảng recordings: mô tả các bản ghi video và trạng thái
@Entity({ name: 'recordings' })
export class Recording {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Quan hệ camera n-1
  @ManyToOne(() => Camera, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'camera_id' })
  camera: Camera;

  @Column({ name: 'storage_path', type: 'varchar', length: 255 })
  storagePath: string;

  @Column({ name: 'duration_sec', type: 'int' })
  durationSec: number;

  @Column({ name: 'started_at', type: 'timestamptz' })
  startedAt: Date;

  @Column({ name: 'ended_at', type: 'timestamptz', nullable: true })
  endedAt?: Date | null;

  @Column({ type: 'varchar', length: 20, default: 'COMPLETED' })
  status: RecordingStatus;

  @Column({ name: 'error_message', type: 'varchar', length: 255, nullable: true })
  errorMessage?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
