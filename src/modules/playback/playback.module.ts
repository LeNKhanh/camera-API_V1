// ============================================================================
// PLAYBACK MODULE - EVENT-TRIGGERED RECORDING
// ============================================================================
// Module tổ chức các components của Playback feature
// 
// Mục đích:
// - Quản lý event-driven recording (tự động record khi có event)
// - Upload video lên R2 storage
// - Cung cấp REST API để quản lý playbacks
// 
// Components:
// - PlaybackService: Business logic (FFmpeg recording, R2 upload)
// - PlaybackController: REST API endpoints
// - Entities: Playback, Event, Camera
// 
// Dependencies:
// - TypeOrmModule: Database access
// - StorageModule: R2 upload service
// - JwtAuthGuard: Authentication
// - RolesGuard: Authorization (RBAC)
// ============================================================================

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PlaybackService } from './playback.service';
import { PlaybackController } from './playback.controller';
import { Playback } from '../../typeorm/entities/playback.entity';
import { Event } from '../../typeorm/entities/event.entity';
import { Camera } from '../../typeorm/entities/camera.entity';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    // Import entities để có thể inject repositories
    TypeOrmModule.forFeature([Playback, Event, Camera]),
    // Import StorageModule để inject StorageService
    StorageModule,
  ],
  controllers: [PlaybackController],
  providers: [PlaybackService],
  exports: [PlaybackService], // Export để EventService có thể dùng
})
export class PlaybackModule {}
