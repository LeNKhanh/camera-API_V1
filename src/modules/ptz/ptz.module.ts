import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Camera } from '../../typeorm/entities/camera.entity';
import { PtzLog } from '../../typeorm/entities/ptz-log.entity';

// Barrel import (tạm) để test TS resolution nếu IDE vẫn báo đỏ direct path
import { PtzService } from './ptz.service';
import { PtzController } from './ptz.controller';
import { PtzLogsAdvancedController } from './ptz-logs-advanced.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Camera, PtzLog]),
    AuthModule,
  ],
  providers: [PtzService],
  controllers: [PtzController, PtzLogsAdvancedController],
  exports: [PtzService],
})
export class PtzModule {}
