// CameraModule: gom controller + service cho camera
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Camera } from '../../typeorm/entities/camera.entity';
import { CameraService } from './camera.service';
import { CameraController } from './camera.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Camera]),
    AuthModule,
  ],
  controllers: [CameraController],
  providers: [CameraService],
  exports: [CameraService],
})
export class CameraModule {}
