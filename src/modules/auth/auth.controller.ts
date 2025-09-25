import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { IsIn, IsString, MinLength } from 'class-validator';

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

class LoginDto {
  @IsString()
  username: string;

  @IsString()
  password: string;
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
  async login(@Body() dto: LoginDto) {
    const token = await this.authService.validateAndLogin(dto.username, dto.password);
    return { accessToken: token };
  }
}
