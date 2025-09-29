// Entity User: ánh xạ bảng users và kiểu role
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type UserRole = 'ADMIN' | 'OPERATOR' | 'VIEWER';

// Bảng users: lưu thông tin đăng nhập và vai trò
@Entity({ name: 'users' })
export class User {
  // Khóa chính UUID
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Tên đăng nhập (unique)
  @Column({ type: 'varchar', length: 50, unique: true })
  username: string;

  // Mật khẩu đã được băm (bcrypt)
  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash: string;

  // Vai trò RBAC
  @Column({ type: 'varchar', length: 20 })
  role: UserRole;

  // Hash refresh token hiện hành (rotate sau mỗi lần refresh). Nullable nếu chưa cấp hoặc đã logout
  @Column({ name: 'refresh_token_hash', type: 'varchar', length: 255, nullable: true })
  refreshTokenHash: string | null;

  // Thời điểm refresh token hết hạn (UTC). Cho phép chủ động thu hồi trước khi JWT tự hết hạn
  @Column({ name: 'refresh_token_exp', type: 'timestamptz', nullable: true })
  refreshTokenExpiresAt: Date | null;

  // Thời điểm tạo
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
