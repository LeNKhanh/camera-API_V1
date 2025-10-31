// StreamModule: tập hợp controller/service cho tính năng phát trực tuyến (minh họa)
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Camera } from '../../typeorm/entities/camera.entity';
import { StreamService } from './stream.service';
import { StreamController } from './stream.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Camera]),
    AuthModule,
  ],
  controllers: [StreamController],
  providers: [StreamService],
})
export class StreamModule {}
