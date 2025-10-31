// AuthService: Xử lý nghiệp vụ đăng ký và đăng nhập bằng JWT
import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';

import { User, UserRole } from '../../typeorm/entities/user.entity';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // access token TTL (seconds)
  refreshExpiresAt: string; // ISO
}

const ACCESS_EXPIRES = 60 * 60 * 2; // 2h (khớp JwtModule)
function refreshTtlSeconds(): number {
  const env = process.env.REFRESH_TOKEN_TTL_SEC || process.env.REFRESH_TOKEN_TTL;
  if (!env) return 60 * 60 * 24 * 7; // 7 ngày
  const n = parseInt(env, 10);
  return Number.isFinite(n) && n > 0 ? n : 60 * 60 * 24 * 7;
}

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
  async validateAndLogin(username: string, password: string): Promise<TokenPair> {
    // If SSO is enabled, local username/password login is disabled
    if (process.env.SSO_API_KEY) throw new ForbiddenException('SSO enabled - local login disabled');
    const user = await this.usersRepo.findOne({ where: { username } });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    return this.issueTokenPair(user);
  }

  private async issueTokenPair(user: User): Promise<TokenPair> {
    if (process.env.SSO_API_KEY) throw new ForbiddenException('SSO enabled - token issuance disabled');
    const payload = { sub: user.id, username: user.username, role: user.role };
    const accessToken = this.jwtService.sign(payload); // JwtModule chứa expiresIn=2h
    // Refresh token đơn giản: random dựa trên salt + user id + time, sau đó hash lưu DB
    const raw = (await bcrypt.genSalt(10)) + ':' + user.id + ':' + Date.now();
    const refreshPlain = Buffer.from(raw).toString('base64url');
    const refreshHash = await bcrypt.hash(refreshPlain, 10);
    const ttl = refreshTtlSeconds();
    const expDate = new Date(Date.now() + ttl * 1000);
    await this.usersRepo.update(user.id, { refreshTokenHash: refreshHash, refreshTokenExpiresAt: expDate });
    return { accessToken, refreshToken: refreshPlain, expiresIn: ACCESS_EXPIRES, refreshExpiresAt: expDate.toISOString() };
  }

  async refresh(userId: string, refreshToken: string): Promise<TokenPair> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user || !user.refreshTokenHash) throw new ForbiddenException('Refresh denied');
    if (!user.refreshTokenExpiresAt || user.refreshTokenExpiresAt.getTime() < Date.now()) {
      throw new ForbiddenException('Refresh expired');
    }
    const ok = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!ok) throw new ForbiddenException('Refresh invalid');
    return this.issueTokenPair(user);
  }

  async logout(userId: string): Promise<{ success: true }> {
    await this.usersRepo.update(userId, { refreshTokenHash: null, refreshTokenExpiresAt: null });
    return { success: true };
  }

  async getProfile(userId: string) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');
    return { id: user.id, username: user.username, role: user.role, createdAt: user.createdAt };
  }
}
