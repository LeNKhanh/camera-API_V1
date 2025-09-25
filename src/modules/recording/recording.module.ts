// RecordingModule: gom controller + service cho chức năng ghi hình
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Recording } from '../../typeorm/entities/recording.entity';
import { Camera } from '../../typeorm/entities/camera.entity';
import { RecordingService } from './recording.service';
import { RecordingController } from './recording.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Recording, Camera])],
  controllers: [RecordingController],
  providers: [RecordingService],
})
export class RecordingModule {}
