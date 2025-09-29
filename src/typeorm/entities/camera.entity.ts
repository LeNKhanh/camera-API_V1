// Entity Camera: ánh xạ bảng cameras trong Postgres
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// Bảng cameras: mô tả thiết bị và cấu hình kết nối
@Entity({ name: 'cameras' })
export class Camera {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'ip_address', type: 'varchar', length: 100, unique: true })
  ipAddress: string;

  @Column({ name: 'rtsp_url', type: 'varchar', length: 255, nullable: true })
  rtspUrl?: string | null;

  @Column({ name: 'rtsp_port', type: 'int', default: 554 })
  rtspPort: number;

  // Cổng SDK (ví dụ Dahua: 37777); để riêng với RTSP
  @Column({ name: 'sdk_port', type: 'int', nullable: true })
  sdkPort?: number | null;

  @Column({ name: 'onvif_url', type: 'varchar', length: 255, nullable: true })
  onvifUrl?: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  username?: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  password?: string | null;

  @Column({ type: 'varchar', length: 20, default: 'H.264' })
  codec: string;

  @Column({ type: 'varchar', length: 20, default: '1080p' })
  resolution: string;

  // Thông tin nhà sản xuất (Dahua/Hikvision/Onvif...)
  @Column({ type: 'varchar', length: 50, nullable: true })
  vendor?: string | null;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
