// ============================================================================
// PLAYBACK MODULE
// ============================================================================
// Module tổ chức các components của Playback feature
// 
// Components:
// - PlaybackService: Business logic
// - PlaybackController: REST API endpoints
// - Entities: Playback, Recording, Camera
// 
// Dependencies:
// - TypeOrmModule: Database access
// - JwtAuthGuard: Authentication
// - RolesGuard: Authorization (RBAC)
// ============================================================================

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PlaybackService } from './playback.service';
import { PlaybackController } from './playback.controller';
import { Playback } from '../../typeorm/entities/playback.entity';
import { Recording } from '../../typeorm/entities/recording.entity';
import { Camera } from '../../typeorm/entities/camera.entity';

@Module({
  imports: [
    // Import entities để có thể inject repositories
    TypeOrmModule.forFeature([Playback, Recording, Camera]),
  ],
  controllers: [PlaybackController],
  providers: [PlaybackService],
  exports: [PlaybackService], // Export nếu module khác cần dùng
})
export class PlaybackModule {}
