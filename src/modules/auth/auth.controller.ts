import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards, Req, Headers, UnauthorizedException, BadRequestException } from '@nestjs/common';
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

  // Đặt optional để vào được controller rồi tự chuẩn hoá fallback (refresh_token, token ...)
  @IsOptional()
  @IsString({ message: 'refreshToken phải là chuỗi' })
  refreshToken?: string;
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
  async refresh(
    @Body() dto: RefreshDto,
    @Headers('authorization') auth?: string,
    @Headers('x-refresh-token') xRefreshToken?: string,
    @Req() req?: any,
  ): Promise<any> {
    const rawBody = (req && req.body) || {};

    // Thu thập các nguồn có thể chứa refresh token
    let refreshToken = dto.refreshToken
      ?? rawBody.refreshToken
      ?? rawBody.refresh_token
      ?? rawBody.token
      ?? xRefreshToken
      ?? (req?.cookies ? req.cookies['refreshToken'] : undefined);

    if (typeof refreshToken === 'string') refreshToken = refreshToken.trim();

    let userId = dto.userId;
    if (!userId && auth?.startsWith('Bearer ')) {
      try {
        const token = auth.substring(7).trim();
        const decoded: any = this.authService['jwtService'].decode(token);
        if (decoded?.sub) userId = decoded.sub;
      } catch (e) {
        if (process.env.REFRESH_DEBUG === '1') console.log('DECODE_JWT_FAILED', (e as any)?.message);
      }
    }

    if (process.env.REFRESH_DEBUG === '1') {
      console.log('DEBUG_REFRESH_SOURCES', {
        bodyKeys: Object.keys(rawBody || {}),
        dto,
        xRefreshToken: !!xRefreshToken,
        cookieKeys: req?.cookies ? Object.keys(req.cookies) : [],
        normalized: { userId, hasRefresh: !!refreshToken, len: refreshToken?.length },
      });
    }

    if (!userId) throw new UnauthorizedException('Missing userId (body userId hoặc Bearer JWT)');
    if (!refreshToken) throw new BadRequestException('Missing refreshToken (body/alias/header/cookie)');
    if (refreshToken.length < 20) throw new BadRequestException('refreshToken quá ngắn hoặc không hợp lệ');
    return this.authService.refresh(userId, refreshToken);
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
