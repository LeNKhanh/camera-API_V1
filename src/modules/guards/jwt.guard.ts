// JwtAuthGuard: Áp dụng chiến lược 'jwt' của Passport để xác thực Bearer token
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Guard JWT dùng passport-jwt để bảo vệ route
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
