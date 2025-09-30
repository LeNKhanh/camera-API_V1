import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards, Req, Headers, UnauthorizedException } from '@nestjs/common';
import { IsIn, IsString, MinLength, IsNotEmpty, IsUUID, IsOptional } from 'class-validator';
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
class RefreshDto {
  @IsOptional()
  @IsUUID('4', { message: 'userId phải là UUID hợp lệ dạng v4' })
  userId?: string;

  @IsString({ message: 'refreshToken phải là chuỗi' })
  @IsNotEmpty({ message: 'refreshToken không được rỗng' })
  refreshToken: string;
}
class LogoutDto {
  @IsOptional()
  @IsUUID('4', { message: 'userId phải là UUID hợp lệ dạng v4' })
  userId?: string;
}

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
  async refresh(@Body() dto: RefreshDto, @Headers('authorization') auth?: string): Promise<any> {
    if (process.env.REFRESH_DEBUG === '1') {
      console.log('DEBUG_REFRESH_BODY', dto);
    }
    let userId = dto.userId;
    if (!userId && auth?.startsWith('Bearer ')) {
      // Fallback: giải mã JWT để lấy sub
      try {
        const token = auth.substring(7).trim();
        const decoded: any = this.authService['jwtService'].decode(token);
        if (decoded?.sub) userId = decoded.sub;
      } catch (e) {
        // bỏ qua decode lỗi
      }
    }
    if (!userId) throw new UnauthorizedException('Missing userId (body userId hoặc Bearer JWT)');
    return this.authService.refresh(userId, dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Body() dto: LogoutDto, @Headers('authorization') auth?: string): Promise<any> {
    let userId = dto.userId;
    if (!userId && auth?.startsWith('Bearer ')) {
      try {
        const token = auth.substring(7).trim();
        const decoded: any = this.authService['jwtService'].decode(token);
        if (decoded?.sub) userId = decoded.sub;
      } catch {}
    }
    if (!userId) throw new UnauthorizedException('Missing userId (body userId hoặc Bearer JWT)');
    return this.authService.logout(userId);
  }

}
