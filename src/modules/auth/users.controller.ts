import { Controller, Get, UseGuards, Req, Put, Body, Param, Delete, ParseUUIDPipe, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt.guard';
import { AuthService } from './auth.service';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { User, UserRole } from '../../typeorm/entities/user.entity';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @IsIn(['ADMIN','OPERATOR','VIEWER'])
  role?: UserRole;
}

// UsersController: cung cấp endpoint profile thay cho /auth/me
@Controller('users')
export class UsersController {
  constructor(
    private readonly authService: AuthService,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
  ) {}

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async profile(@Req() req: any): Promise<any> {
    return this.authService.getProfile(req.user.userId);
  }

  // ADMIN: danh sách user (đơn giản, không pagination ở đây)
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async list(): Promise<any[]> {
    const users = await this.usersRepo.find({ order: { createdAt: 'DESC' } });
    return users.map(u => ({ id: u.id, username: u.username, role: u.role, createdAt: u.createdAt }));
  }

  // ADMIN: cập nhật role hoặc password
  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async updateUser(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateUserDto, @Req() req: any) {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) throw new ForbiddenException('User not found');
    const patch: Partial<User> = {};
    if (dto.password) {
      // Tái sử dụng bcrypt từ AuthService bằng cách gọi register logic? Ở đây hash nhanh trực tiếp để tránh thay đổi register.
      const bcrypt = await import('bcrypt');
      patch.passwordHash = await bcrypt.hash(dto.password, 10);
    }
    if (dto.role) patch.role = dto.role;
    if (Object.keys(patch).length === 0) return { updated: false };
    await this.usersRepo.update(id, patch);
    return { updated: true };
  }

  // ADMIN: xoá user (cấm tự xoá chính mình để tránh mất tài khoản quản trị cuối cùng)
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async deleteUser(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: any) {
    if (req.user.userId === id) {
      throw new ForbiddenException('Không thể tự xoá tài khoản đang đăng nhập');
    }
    await this.usersRepo.delete(id);
    return { deleted: true };
  }
}
