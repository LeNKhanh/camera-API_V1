// JwtStrategy: Đọc JWT từ Authorization Bearer, xác minh, và gắn payload vào req.user
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'dev_secret',
    });
  }

  // Trả về payload đưa vào req.user
  async validate(payload: any) {
    return { userId: payload.sub, username: payload.username, role: payload.role };
  }
}
