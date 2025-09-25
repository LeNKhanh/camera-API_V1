// AuthService: Xử lý nghiệp vụ đăng ký và đăng nhập bằng JWT
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';

import { User, UserRole } from '../../typeorm/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  // Đăng ký người dùng: băm mật khẩu và lưu
  // Luồng: nhận username/password/role -> bcrypt.hash -> usersRepo.save -> trả về thông tin cơ bản
  async register(username: string, password: string, role: UserRole) {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = this.usersRepo.create({ username, passwordHash, role });
    await this.usersRepo.save(user);
    return { id: user.id, username: user.username, role: user.role };
  }

  // Xác thực đăng nhập và sinh JWT
  // Luồng: tìm user theo username -> so sánh bcrypt -> nếu đúng, ký JWT với payload {sub, username, role}
  async validateAndLogin(username: string, password: string): Promise<string> {
    const user = await this.usersRepo.findOne({ where: { username } });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    const payload = { sub: user.id, username: user.username, role: user.role };
    return this.jwtService.sign(payload);
  }
}
