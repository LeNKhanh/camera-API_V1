// Entity Event: ánh xạ bảng events; type: MOTION/ERROR/ALERT
import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, JoinColumn } from 'typeorm';
import { Camera } from './camera.entity';

export type EventType = 'MOTION' | 'ERROR' | 'ALERT';

// Bảng events: ghi nhận các sự kiện như chuyển động, lỗi, cảnh báo
@Entity({ name: 'events' })
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Quan hệ camera n-1
  @ManyToOne(() => Camera, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'camera_id' })
  camera: Camera;

  @Column({ type: 'varchar', length: 50 })
  type: EventType;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ name: 'ack', type: 'boolean', default: false })
  ack: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
