// ============================================================================
// PLAYBACK API - Database Schema Verification Script
// ============================================================================
// Mục đích: Kiểm tra cấu trúc bảng playbacks và mối quan hệ với recordings/cameras
// ============================================================================

import AppDataSource from '../src/data-source';
import { Playback } from '../src/typeorm/entities/playback.entity';
import { Recording } from '../src/typeorm/entities/recording.entity';
import { Camera } from '../src/typeorm/entities/camera.entity';

async function checkPlaybacksSchema() {
  try {
    console.log('========================================');
    console.log('PLAYBACK SCHEMA VERIFICATION');
    console.log('========================================\n');

    // Initialize database connection
    await AppDataSource.initialize();
    console.log('✓ Database connected\n');

    // Get table metadata
    const playbackRepo = AppDataSource.getRepository(Playback);
    const metadata = playbackRepo.metadata;

    console.log('TABLE: playbacks');
    console.log('----------------------------------------');

    // Show columns
    console.log('\nCOLUMNS:');
    metadata.columns.forEach(col => {
      console.log(
        `  - ${col.propertyName.padEnd(25)} | ${col.type.toString().padEnd(20)} | ` +
        `Nullable: ${col.isNullable ? 'YES' : 'NO'.padEnd(3)} | ` +
        `Default: ${col.default || 'NULL'}`
      );
    });

    // Show relations
    console.log('\nRELATIONS:');
    metadata.relations.forEach(rel => {
      console.log(
        `  - ${rel.propertyName.padEnd(15)} | ${rel.relationType.padEnd(15)} | ` +
        `Target: ${rel.type.toString().split(' ').pop()} | ` +
        `FK: ${rel.joinColumns.map(jc => jc.databaseName).join(', ')}`
      );
    });

    // Show foreign keys
    console.log('\nFOREIGN KEYS:');
    metadata.foreignKeys.forEach(fk => {
      console.log(
        `  - ${fk.name.padEnd(35)} | ` +
        `Columns: ${fk.columnNames.join(', ').padEnd(20)} | ` +
        `References: ${fk.referencedTablePath}.${fk.referencedColumnNames.join(', ')} | ` +
        `ON DELETE: ${fk.onDelete || 'NO ACTION'}`
      );
    });

    // Show indexes
    console.log('\nINDEXES:');
    metadata.indices.forEach(idx => {
      console.log(
        `  - ${idx.name?.padEnd(35) || '(unnamed)'.padEnd(35)} | ` +
        `Columns: ${idx.columns.map(c => c.databaseName).join(', ')}`
      );
    });

    // Count records
    const count = await playbackRepo.count();
    console.log(`\nTOTAL RECORDS: ${count}`);

    // Show sample data
    if (count > 0) {
      console.log('\nSAMPLE DATA (latest 3):');
      const samples = await playbackRepo.find({
        take: 3,
        order: { createdAt: 'DESC' },
        relations: ['recording', 'camera'],
      });

      samples.forEach((playback, index) => {
        console.log(`\n  [${index + 1}] ID: ${playback.id}`);
        console.log(`      Recording: ${playback.recording.id} (${playback.recording.status})`);
        console.log(`      Camera: ${playback.camera.name} (Channel ${playback.camera.channel})`);
        console.log(`      Protocol: ${playback.protocol}`);
        console.log(`      Status: ${playback.status}`);
        console.log(`      Position: ${playback.currentPositionSec}s`);
        console.log(`      User: ${playback.username} (ID: ${playback.userId})`);
        console.log(`      Created: ${playback.createdAt.toISOString()}`);
        if (playback.startedAt) {
          console.log(`      Started: ${playback.startedAt.toISOString()}`);
        }
        if (playback.endedAt) {
          console.log(`      Ended: ${playback.endedAt.toISOString()}`);
          const duration = (playback.endedAt.getTime() - playback.startedAt!.getTime()) / 1000;
          console.log(`      Watch Duration: ${duration}s`);
        }
      });
    }

    // Test cascade delete behavior
    console.log('\n========================================');
    console.log('CASCADE DELETE VERIFICATION');
    console.log('========================================\n');

    const recordingRepo = AppDataSource.getRepository(Recording);
    const cameraRepo = AppDataSource.getRepository(Camera);

    // Check recording foreign key
    const recordingFk = metadata.foreignKeys.find(fk =>
      fk.referencedTablePath === 'recordings'
    );
    console.log('Recording FK:');
    console.log(`  Name: ${recordingFk?.name}`);
    console.log(`  ON DELETE: ${recordingFk?.onDelete || 'NO ACTION'}`);
    console.log(`  Expected: CASCADE`);
    console.log(
      `  Status: ${recordingFk?.onDelete === 'CASCADE' ? '✓ CORRECT' : '✗ INCORRECT'}`
    );

    // Check camera foreign key
    const cameraFk = metadata.foreignKeys.find(fk => fk.referencedTablePath === 'cameras');
    console.log('\nCamera FK:');
    console.log(`  Name: ${cameraFk?.name}`);
    console.log(`  ON DELETE: ${cameraFk?.onDelete || 'NO ACTION'}`);
    console.log(`  Expected: CASCADE`);
    console.log(
      `  Status: ${cameraFk?.onDelete === 'CASCADE' ? '✓ CORRECT' : '✗ INCORRECT'}`
    );

    // Performance indexes check
    console.log('\n========================================');
    console.log('PERFORMANCE INDEXES CHECK');
    console.log('========================================\n');

    const expectedIndexes = [
      { name: 'IDX_playbacks_recording_id', columns: ['recording_id'] },
      { name: 'IDX_playbacks_camera_id', columns: ['camera_id'] },
      { name: 'IDX_playbacks_status', columns: ['status'] },
      { name: 'IDX_playbacks_created_at', columns: ['created_at'] },
      { name: 'IDX_playbacks_user_created', columns: ['user_id', 'created_at'] },
    ];

    expectedIndexes.forEach(expected => {
      const found = metadata.indices.find(idx => idx.name === expected.name);
      if (found) {
        console.log(`✓ ${expected.name.padEnd(40)} | Columns: ${expected.columns.join(', ')}`);
      } else {
        console.log(`✗ ${expected.name.padEnd(40)} | MISSING!`);
      }
    });

    console.log('\n========================================');
    console.log('SCHEMA VERIFICATION COMPLETE');
    console.log('========================================\n');

    await AppDataSource.destroy();
    console.log('✓ Database connection closed');
  } catch (error) {
    console.error('ERROR:', error);
    process.exit(1);
  }
}

// Run verification
checkPlaybacksSchema();
