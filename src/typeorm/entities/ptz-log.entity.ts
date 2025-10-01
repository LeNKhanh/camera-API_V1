// Entity PtzLog: ghi lịch sử lệnh PTZ
import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, JoinColumn } from 'typeorm';
const dateType = process.env.NODE_ENV === 'test' ? 'datetime' : 'timestamptz';
import { Camera } from './camera.entity';

@Entity({ name: 'ptz_logs' })
export class PtzLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Thay vì foreign key trực tiếp -> lưu thông tin handle đăng nhập SDK & channel
  // ILoginID: định danh phiên đăng nhập (có thể ánh xạ camera.id hoặc handle thật trong tương lai)
  @Column({ name: 'ILoginID', type: 'varchar', length: 64 })
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

  @CreateDateColumn({ name: 'created_at', type: dateType as any })
  createdAt: Date;
}
