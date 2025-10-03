// ============================================================================
// MIGRATION: CREATE PLAYBACKS TABLE
// ============================================================================
// Mục đích: Tạo bảng playbacks để track session xem video đã ghi
// 
// Schema design:
// - playbacks.recording_id -> recordings.id (CASCADE DELETE)
// - playbacks.camera_id -> cameras.id (CASCADE DELETE)
// - Lưu stream URL, protocol, status, position cho tính năng pause/resume
// - Track user info cho audit/analytics
// 
// Indexes:
// - recording_id: Query playback history của recording
// - camera_id: Query playback history của camera
// - status: Filter active/completed sessions
// - created_at: Sắp xếp theo thời gian
// ============================================================================

import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreatePlaybacksTable1759404000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ------------------------------------------------------------------------
    // CREATE TABLE: playbacks
    // ------------------------------------------------------------------------
    await queryRunner.createTable(
      new Table({
        name: 'playbacks',
        columns: [
          // Primary Key
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          
          // Foreign Keys
          {
            name: 'recording_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'camera_id',
            type: 'uuid',
            isNullable: false,
          },
          
          // Playback session info
          {
            name: 'stream_url',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'protocol',
            type: 'varchar',
            length: '20',
            default: "'HLS'",
          },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            default: "'PENDING'",
          },
          
          // Position & timing
          {
            name: 'current_position_sec',
            type: 'int',
            isNullable: true,
            default: 0,
          },
          {
            name: 'started_at',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'ended_at',
            type: 'timestamptz',
            isNullable: true,
          },
          
          // User tracking
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'username',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          
          // Error tracking
          {
            name: 'error_message',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          
          // Metadata
          {
            name: 'user_agent',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'client_ip',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          
          // Audit timestamps
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'now()',
          },
        ],
      }),
      true, // ifNotExists
    );

    // ------------------------------------------------------------------------
    // CREATE FOREIGN KEYS
    // ------------------------------------------------------------------------
    
    // FK: playbacks.recording_id -> recordings.id (CASCADE DELETE)
    await queryRunner.createForeignKey(
      'playbacks',
      new TableForeignKey({
        name: 'FK_playbacks_recording',
        columnNames: ['recording_id'],
        referencedTableName: 'recordings',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE', // Xóa recording -> xóa playback sessions
      }),
    );

    // FK: playbacks.camera_id -> cameras.id (CASCADE DELETE)
    await queryRunner.createForeignKey(
      'playbacks',
      new TableForeignKey({
        name: 'FK_playbacks_camera',
        columnNames: ['camera_id'],
        referencedTableName: 'cameras',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE', // Xóa camera -> xóa playback history
      }),
    );

    // ------------------------------------------------------------------------
    // CREATE INDEXES (Performance optimization)
    // ------------------------------------------------------------------------
    
    // Index: recording_id (query playback history của recording)
    await queryRunner.createIndex(
      'playbacks',
      new TableIndex({
        name: 'IDX_playbacks_recording_id',
        columnNames: ['recording_id'],
      }),
    );

    // Index: camera_id (query playback history của camera)
    await queryRunner.createIndex(
      'playbacks',
      new TableIndex({
        name: 'IDX_playbacks_camera_id',
        columnNames: ['camera_id'],
      }),
    );

    // Index: status (filter active sessions, analytics)
    await queryRunner.createIndex(
      'playbacks',
      new TableIndex({
        name: 'IDX_playbacks_status',
        columnNames: ['status'],
      }),
    );

    // Index: created_at (sort by time, pagination)
    await queryRunner.createIndex(
      'playbacks',
      new TableIndex({
        name: 'IDX_playbacks_created_at',
        columnNames: ['created_at'],
      }),
    );

    // Composite index: user_id + created_at (user playback history)
    await queryRunner.createIndex(
      'playbacks',
      new TableIndex({
        name: 'IDX_playbacks_user_created',
        columnNames: ['user_id', 'created_at'],
      }),
    );

    console.log('✅ Created playbacks table with foreign keys and indexes');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ------------------------------------------------------------------------
    // ROLLBACK: Drop table (cascade will handle FKs)
    // ------------------------------------------------------------------------
    await queryRunner.dropTable('playbacks', true);
    console.log('✅ Dropped playbacks table');
  }
}
