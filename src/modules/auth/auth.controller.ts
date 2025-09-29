import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards, Req } from '@nestjs/common';
import { IsIn, IsString, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../guards/jwt.guard';
import { RateLimitLoginGuard, RateLimitRefreshGuard } from '../../common/rate-limit.guard';

import { AuthService } from './auth.service';
import { UserRole } from '../../typeorm/entities/user.entity';

// DTO: dữ liệu đăng ký/đăng nhập
class RegisterDto {
  @IsString()
  username: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsIn(['ADMIN', 'OPERATOR', 'VIEWER'])
  role: UserRole;
}

class LoginDto { @IsString() username: string; @IsString() password: string; }
class RefreshDto { @IsString() userId: string; @IsString() refreshToken: string; }
class LogoutDto { @IsString() userId: string; }

@Controller('auth')
export class AuthController {
// AuthController: Quản lý luồng đăng ký/đăng nhập
// Luồng chính
// - POST /auth/register: nhận username/password/role -> gọi AuthService.register -> trả về user đã tạo (ẩn password)
// - POST /auth/login: nhận username/password -> gọi AuthService.validateAndLogin -> trả về JWT accessToken
  constructor(private readonly authService: AuthService) {}

  // Đăng ký người dùng mới (chỉ phục vụ seed/dev; prod nên khóa hoặc chỉ admin dùng)
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto.username, dto.password, dto.role);
  }

  // Đăng nhập: trả về accessToken JWT
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RateLimitLoginGuard)
  async login(@Body() dto: LoginDto): Promise<any> {
    return this.authService.validateAndLogin(dto.username, dto.password);
  }

  @Post('refresh')
  @UseGuards(RateLimitRefreshGuard)
  async refresh(@Body() dto: RefreshDto): Promise<any> {
    return this.authService.refresh(dto.userId, dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Body() dto: LogoutDto): Promise<any> {
    return this.authService.logout(dto.userId);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: any): Promise<any> {
    return this.authService.getProfile(req.user.userId);
  }
}
