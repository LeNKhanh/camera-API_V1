// Entity PtzLog: ghi lịch sử lệnh PTZ
import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, JoinColumn } from 'typeorm';
const dateType = process.env.NODE_ENV === 'test' ? 'datetime' : 'timestamptz';
import { Camera } from './camera.entity';

@Entity({ name: 'ptz_logs' })
export class PtzLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Foreign key relation to Camera (cascade delete)
  @ManyToOne(() => Camera, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ILoginID' })
  camera: Camera;

  // ILoginID: định danh camera (camera.id) - giờ đã có FK constraint
  @Column({ name: 'ILoginID', type: 'uuid' })
  ILoginID: string;

  // nChannelID: channel của camera tại thời điểm ghi log
  @Column({ name: 'nChannelID', type: 'int', default: 1 })
  nChannelID: number;

  @Column({ type: 'varchar', length: 40 })
  action: string; // PAN_LEFT / PAN_RIGHT / ... / STOP

  // dwPTZCommand numeric code (mapping action -> vendor code) mới thêm để thuận tiện debug/phân tích
  @Column({ name: 'command_code', type: 'int', default: 0 })
  commandCode: number;

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

  // Raw vendor parameters (tùy lệnh – có thể null)
  @Column({ name: 'param1', type: 'int', nullable: true })
  param1?: number | null;
  @Column({ name: 'param2', type: 'int', nullable: true })
  param2?: number | null;
  @Column({ name: 'param3', type: 'int', nullable: true })
  param3?: number | null;

  @CreateDateColumn({ name: 'created_at', type: dateType as any })
  createdAt: Date;
}
