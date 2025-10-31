// EventModule: gom controller + service cho events
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Event } from '../../typeorm/entities/event.entity';
import { Camera } from '../../typeorm/entities/camera.entity';
import { EventService } from './event.service';
import { EventController } from './event.controller';
import { PlaybackModule } from '../playback/playback.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Event, Camera]),
    PlaybackModule, // Import PlaybackModule để inject PlaybackService
    AuthModule,
  ],
  controllers: [EventController],
  providers: [EventService],
  exports: [EventService],
})
export class EventModule {}
