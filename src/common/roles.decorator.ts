// Roles decorator: đính kèm metadata các vai trò được phép vào handler
import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../typeorm/entities/user.entity';

// Decorator @Roles(...roles): đánh dấu route chỉ cho phép vai trò nhất định
export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
