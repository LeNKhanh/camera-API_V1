// AuthModule: Khai báo providers/controller cho tính năng xác thực
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from '../../typeorm/entities/user.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersController } from './users.controller';
import { JwtStrategy } from './jwt.strategy';

@Module({
  // Thành phần:
  // - TypeOrmModule.forFeature(User): repository thao tác bảng users
  // - PassportModule + JwtModule: hạ tầng JWT
  imports: [
    TypeOrmModule.forFeature([User]),
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev_secret',
      signOptions: { expiresIn: '2h' },
    }),
  ],
  controllers: [AuthController, UsersController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule, TypeOrmModule], // Export TypeOrmModule to share User repository
})
export class AuthModule {}
