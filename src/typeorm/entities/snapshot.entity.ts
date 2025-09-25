// Entity Snapshot: lưu ảnh chụp và thời điểm
import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, JoinColumn } from 'typeorm';
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

  @Column({ name: 'captured_at', type: 'timestamptz', default: () => 'now()' })
  capturedAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
