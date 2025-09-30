import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt.guard';
import { AuthService } from './auth.service';

// UsersController: cung cấp endpoint profile thay cho /auth/me
@Controller('users')
export class UsersController {
  constructor(private readonly authService: AuthService) {}

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async profile(@Req() req: any): Promise<any> {
    return this.authService.getProfile(req.user.userId);
  }
}
