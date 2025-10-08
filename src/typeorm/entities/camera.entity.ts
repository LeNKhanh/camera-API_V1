// Entity Camera: ánh xạ bảng cameras trong Postgres
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn, Unique } from 'typeorm';
const dateType = process.env.NODE_ENV === 'test' ? 'datetime' : 'timestamptz';

// Bảng cameras: mô tả thiết bị và cấu hình kết nối
// Multi-channel: Một thiết bị (ipAddress + sdkPort) có thể có nhiều kênh (channel) – ví dụ NVR.
// Ta đảm bảo duy nhất theo cặp (ipAddress, channel) để có thể lưu nhiều channel cùng IP.
@Entity({ name: 'cameras' })
@Unique(['ipAddress', 'channel'])
export class Camera {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  // Bỏ unique đơn lẻ, dùng composite Unique(ipAddress, channel)
  @Column({ name: 'ip_address', type: 'varchar', length: 100 })
  ipAddress: string;
  // Kênh (channel) của camera trên thiết bị / NVR. Mặc định 1.
  @Column({ type: 'int', default: 1 })
  channel: number;

  @Column({ name: 'rtsp_url', type: 'varchar', length: 255, nullable: true })
  rtspUrl?: string | null;

  @Column({ name: 'rtsp_port', type: 'int', default: 554 })
  rtspPort: number;

  // Cổng SDK Dahua (default 37777). Giữ nullable để tránh lỗi synchronize với dữ liệu cũ chưa có giá trị.
  @Column({ name: 'sdk_port', type: 'int', nullable: true, default: 37777 })
  sdkPort?: number | null;

  // Cổng ONVIF (default 80). Có thể là 8000, 8080, 8899, v.v. tuỳ camera.
  @Column({ name: 'onvif_port', type: 'int', nullable: true, default: 80 })
  onvifPort?: number | null;

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

  // Vendor cố định: 'dahua' (đơn giản hoá hệ thống)
  @Column({ type: 'varchar', length: 50, default: 'dahua' })
  vendor: string;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @CreateDateColumn({ name: 'created_at', type: dateType as any })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: dateType as any })
  updatedAt: Date;
}
