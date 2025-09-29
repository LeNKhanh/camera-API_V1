// Entity PtzLog: ghi lịch sử lệnh PTZ
import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, JoinColumn } from 'typeorm';
import { Camera } from './camera.entity';

@Entity({ name: 'ptz_logs' })
export class PtzLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Camera, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'camera_id' })
  camera: Camera;

  @Column({ type: 'varchar', length: 40 })
  action: string; // PAN_LEFT / PAN_RIGHT / ... / STOP

  @Column({ type: 'int', default: 1 })
  speed: number;

  @Column({ name: 'vector_pan', type: 'int', default: 0 })
  vectorPan: number; // -1..1 nhân với speed

  @Column({ name: 'vector_tilt', type: 'int', default: 0 })
  vectorTilt: number; // -1..1 nhân với speed

  @Column({ name: 'vector_zoom', type: 'int', default: 0 })
  vectorZoom: number; // -1..1 nhân với speed

  @Column({ name: 'duration_ms', type: 'int', nullable: true })
  durationMs?: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
