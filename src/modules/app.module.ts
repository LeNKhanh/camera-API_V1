// AppModule: Nối các module nghiệp vụ và cấu hình DB/Config toàn cục
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from './auth/auth.module';
import { CameraModule } from './camera/camera.module';
import { StreamModule } from './stream/stream.module';
import { RecordingModule } from './recording/recording.module';
import { EventModule } from './event/event.module';
import { SnapshotModule } from './snapshot/snapshot.module';
import { PtzModule } from './ptz/ptz.module';
import { PlaybackModule } from './playback/playback.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RolesGuard } from '../common/roles.guard';
import { JwtStrategy } from './auth/jwt.strategy';

import { User } from '../typeorm/entities/user.entity';
import { Camera } from '../typeorm/entities/camera.entity';
import { Recording } from '../typeorm/entities/recording.entity';
import { Event } from '../typeorm/entities/event.entity';
import { Snapshot } from '../typeorm/entities/snapshot.entity';
import { PtzLog } from '../typeorm/entities/ptz-log.entity';
import { Playback } from '../typeorm/entities/playback.entity';

@Module({
  imports: [
    // 1) Module cấu hình: nạp biến môi trường .env
    ConfigModule.forRoot({ isGlobal: true }),

    // 2) Kết nối DB: dùng SQLite in-memory khi NODE_ENV=test, ngược lại Postgres
    // Ưu tiên DATABASE_URL (từ Coolify Environment Variables)
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        const isTest = process.env.NODE_ENV === 'test';
        if (isTest) {
          return {
            type: 'sqlite' as const,
            database: ':memory:',
            dropSchema: true,
            entities: [User, Camera, Recording, Event, Snapshot, PtzLog, Playback],
            synchronize: true,
            logging: false,
          };
        }
        
        // Ưu tiên DATABASE_URL nếu có (Coolify deployment)
        if (process.env.DATABASE_URL) {
          return {
            type: 'postgres' as const,
            url: process.env.DATABASE_URL,
            entities: [User, Camera, Recording, Event, Snapshot, PtzLog, Playback],
            synchronize: false,
            logging: ['error', 'warn'],
          };
        }
        
        // Fallback: Local development với các biến riêng lẻ
        return {
          type: 'postgres' as const,
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432', 10),
          username: process.env.DB_USER || 'postgres',
          password: process.env.DB_PASSWORD || 'postgres',
          database: process.env.DB_NAME || 'Camera_api',
          entities: [User, Camera, Recording, Event, Snapshot, PtzLog, Playback],
          synchronize: false, // Dùng migrations thay vì sync tự động (tránh xung đột đổi cột PTZ)
          logging: ['error', 'warn'],
        };
      },
    }),

    // 3) Các module nghiệp vụ
    AuthModule,
    CameraModule,
    StreamModule,
    RecordingModule,
    EventModule,
    SnapshotModule,
    PtzModule,
    PlaybackModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    JwtStrategy,
    // RolesGuard có thể gắn theo route; nếu muốn toàn cục, bật dòng dưới
    // { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
