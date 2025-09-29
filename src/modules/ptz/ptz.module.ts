import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Camera } from '../../typeorm/entities/camera.entity';
import { PtzService } from './ptz.service';
import { PtzController } from './ptz.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Camera])],
  providers: [PtzService],
  controllers: [PtzController],
  exports: [PtzService],
})
export class PtzModule {}
