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

@Module({
  imports: [
  // 1) Module cấu hình: nạp biến môi trường .env
    ConfigModule.forRoot({ isGlobal: true }),

  // 2) Kết nối DB Postgres qua TypeORM (DB_NAME mặc định: Camera_api)
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'Camera_api',
  entities: [User, Camera, Recording, Event, Snapshot, PtzLog],
      synchronize: true, // Dev: tự sync schema; Prod: nên dùng migration
      logging: ['error', 'warn'],
    }),

    // 3) Các module nghiệp vụ
    AuthModule,
    CameraModule,
    StreamModule,
    RecordingModule,
    EventModule,
    SnapshotModule,
    PtzModule,
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
