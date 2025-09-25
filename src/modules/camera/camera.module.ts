// CameraModule: gom controller + service cho camera
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Camera } from '../../typeorm/entities/camera.entity';
import { CameraService } from './camera.service';
import { CameraController } from './camera.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Camera])],
  controllers: [CameraController],
  providers: [CameraService],
  exports: [CameraService],
})
export class CameraModule {}
