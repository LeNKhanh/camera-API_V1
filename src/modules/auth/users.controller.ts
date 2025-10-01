import { Controller, Get, UseGuards, Req, Put, Body, Param, Delete, ParseUUIDPipe, ForbiddenException, Query } from '@nestjs/common';
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

  // ADMIN: danh sách user với filter + pagination
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async list(
    @Query('username') username?: string,
  @Query('role') role?: string,
    @Query('createdFrom') createdFrom?: string,
    @Query('createdTo') createdTo?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: string,
  ): Promise<any> {
    const qb = this.usersRepo.createQueryBuilder('u');
    if (username) {
      qb.andWhere('LOWER(u.username) LIKE :uName', { uName: `%${username.toLowerCase()}%` });
    }
    if (role) {
      const roles = role.split(',').map(r => r.trim()).filter(r => ['ADMIN','OPERATOR','VIEWER'].includes(r));
      if (roles.length === 1) qb.andWhere('u.role = :r', { r: roles[0] });
      else if (roles.length > 1) qb.andWhere('u.role IN (:...rs)', { rs: roles });
    }
    if (createdFrom) {
      const d = new Date(createdFrom); if (!isNaN(d.getTime())) qb.andWhere('u.created_at >= :cf', { cf: d.toISOString() });
    }
    if (createdTo) {
      const d = new Date(createdTo); if (!isNaN(d.getTime())) qb.andWhere('u.created_at <= :ct', { ct: d.toISOString() });
    }
    const allowedSort = ['username','createdAt','role'];
    const sortCol = allowedSort.includes(sortBy || '') ? (sortBy === 'createdAt' ? 'u.created_at' : `u.${sortBy}`) : 'u.created_at';
    const dir = (sortDir === 'ASC' || sortDir === 'DESC') ? sortDir : 'DESC';
    qb.orderBy(sortCol, dir as any);

    const pageNum = page ? parseInt(page, 10) : undefined;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : undefined;
    if (!pageNum || !pageSizeNum) {
      const rows = await qb.getMany();
      return rows.map(r => ({ id: r.id, username: r.username, role: r.role, createdAt: r.createdAt }));
    }
    const take = Math.min(Math.max(pageSizeNum, 1), 100);
    const skip = (Math.max(pageNum, 1) - 1) * take;
    qb.skip(skip).take(take);
    const [rows, total] = await qb.getManyAndCount();
    return {
      data: rows.map(r => ({ id: r.id, username: r.username, role: r.role, createdAt: r.createdAt })),
      pagination: {
        page: pageNum,
        pageSize: take,
        total,
        totalPages: Math.ceil(total / take) || 1,
      },
      sort: { sortBy: sortBy || 'createdAt', sortDir: dir },
      filtersApplied: {
        username: username || null,
        role: role || null,
        createdFrom: createdFrom || null,
        createdTo: createdTo || null,
      },
    };
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
