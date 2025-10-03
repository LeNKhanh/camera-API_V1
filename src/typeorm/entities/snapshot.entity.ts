// Entity Snapshot: lưu ảnh chụp và thời điểm
import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, JoinColumn } from 'typeorm';
const dateType = process.env.NODE_ENV === 'test' ? 'datetime' : 'timestamptz';
import { Camera } from './camera.entity';

// Bảng snapshots: lưu thông tin ảnh chụp nhanh từ camera
@Entity({ name: 'snapshots' })
export class Snapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Quan hệ camera n-1
  @ManyToOne(() => Camera, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'camera_id' })
  camera: Camera;

  @Column({ name: 'storage_path', type: 'varchar', length: 255 })
  storagePath: string;

  @Column({ name: 'captured_at', type: dateType as any, default: () => (process.env.NODE_ENV === 'test' ? "CURRENT_TIMESTAMP" : 'now()') })
  capturedAt: Date;

  @CreateDateColumn({ name: 'created_at', type: dateType as any })
  createdAt: Date;
}
