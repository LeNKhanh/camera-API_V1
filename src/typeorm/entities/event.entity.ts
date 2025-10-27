// Entity Event: ánh xạ bảng events; type: MOTION/ERROR/ALERT
import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, JoinColumn } from 'typeorm';
const dateType = process.env.NODE_ENV === 'test' ? 'datetime' : 'timestamptz';
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

  // Channel của camera tại thời điểm event xảy ra
  @Column({ name: 'nchannelid', type: 'int', default: 1 })
  nChannelID: number;

  @Column({ type: 'varchar', length: 50 })
  type: EventType;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ name: 'acknowledged', type: 'boolean', default: false })
  ack: boolean;

  @CreateDateColumn({ name: 'created_at', type: dateType as any })
  createdAt: Date;
}
