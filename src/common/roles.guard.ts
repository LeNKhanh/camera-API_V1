// RolesGuard: lấy metadata @Roles và kiểm tra role trong req.user
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ROLES_KEY } from './roles.decorator';
import { UserRole } from '../typeorm/entities/user.entity';

// Guard kiểm tra role trong JWT payload
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user as { role?: UserRole } | undefined;
    if (!user || !user.role) throw new ForbiddenException('Missing role');
    if (!requiredRoles.includes(user.role)) throw new ForbiddenException('Insufficient role');
    return true;
  }
}
