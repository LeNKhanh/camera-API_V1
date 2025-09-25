// EventModule: gom controller + service cho events
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Event } from '../../typeorm/entities/event.entity';
import { Camera } from '../../typeorm/entities/camera.entity';
import { EventService } from './event.service';
import { EventController } from './event.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Event, Camera])],
  controllers: [EventController],
  providers: [EventService],
  exports: [EventService],
})
export class EventModule {}
