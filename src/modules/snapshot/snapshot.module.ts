// SnapshotModule: gom controller + service cho chức năng snapshot
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Camera } from '../../typeorm/entities/camera.entity';
import { Snapshot } from '../../typeorm/entities/snapshot.entity';
import { SnapshotService } from './snapshot.service';
import { SnapshotController } from './snapshot.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Camera, Snapshot])],
  controllers: [SnapshotController],
  providers: [SnapshotService],
})
export class SnapshotModule {}
