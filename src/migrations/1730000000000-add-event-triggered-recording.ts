import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEventTriggeredRecording1730000000000 implements MigrationInterface {
  name = 'AddEventTriggeredRecording1730000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new columns to playbacks table for event-triggered recording
    await queryRunner.query(`
      ALTER TABLE playbacks 
      ADD COLUMN IF NOT EXISTS event_id UUID,
      ADD COLUMN IF NOT EXISTS camera_id UUID,
      ADD COLUMN IF NOT EXISTS recording_status VARCHAR(20) DEFAULT 'PENDING',
      ADD COLUMN IF NOT EXISTS video_url VARCHAR(500),
      ADD COLUMN IF NOT EXISTS local_path VARCHAR(500),
      ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT,
      ADD COLUMN IF NOT EXISTS duration_sec INTEGER,
      ADD COLUMN IF NOT EXISTS codec VARCHAR(20),
      ADD COLUMN IF NOT EXISTS resolution VARCHAR(20),
      ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS error_message TEXT
    `);

    // Add foreign key constraints
    await queryRunner.query(`
      ALTER TABLE playbacks
      ADD CONSTRAINT FK_playbacks_event FOREIGN KEY (event_id) 
      REFERENCES events(id) ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE playbacks
      ADD CONSTRAINT FK_playbacks_camera FOREIGN KEY (camera_id) 
      REFERENCES cameras(id) ON DELETE CASCADE
    `);

    // Create indexes for better query performance
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_playbacks_event ON playbacks(event_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_playbacks_camera ON playbacks(camera_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_playbacks_recording_status ON playbacks(recording_status)`);

    // Drop old columns that are no longer needed
    await queryRunner.query(`ALTER TABLE playbacks DROP COLUMN IF EXISTS recording_id`);
    await queryRunner.query(`ALTER TABLE playbacks DROP COLUMN IF EXISTS user_id`);
    await queryRunner.query(`ALTER TABLE playbacks DROP COLUMN IF EXISTS status`);
    await queryRunner.query(`ALTER TABLE playbacks DROP COLUMN IF EXISTS position`);
    await queryRunner.query(`ALTER TABLE playbacks DROP COLUMN IF EXISTS speed`);
    await queryRunner.query(`ALTER TABLE playbacks DROP COLUMN IF EXISTS stream_url`);
    await queryRunner.query(`ALTER TABLE playbacks DROP COLUMN IF EXISTS protocol`);
    await queryRunner.query(`ALTER TABLE playbacks DROP COLUMN IF EXISTS current_position_sec`);
    await queryRunner.query(`ALTER TABLE playbacks DROP COLUMN IF EXISTS username`);
    await queryRunner.query(`ALTER TABLE playbacks DROP COLUMN IF EXISTS user_agent`);
    await queryRunner.query(`ALTER TABLE playbacks DROP COLUMN IF EXISTS client_ip`);
    await queryRunner.query(`ALTER TABLE playbacks DROP COLUMN IF EXISTS error_message`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop new columns
    await queryRunner.query(`
      ALTER TABLE playbacks
      DROP COLUMN IF EXISTS event_id,
      DROP COLUMN IF EXISTS recording_status,
      DROP COLUMN IF EXISTS video_url,
      DROP COLUMN IF EXISTS local_path,
      DROP COLUMN IF EXISTS file_size_bytes,
      DROP COLUMN IF EXISTS duration_sec,
      DROP COLUMN IF EXISTS codec,
      DROP COLUMN IF EXISTS resolution
    `);

    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS idx_playbacks_event`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_playbacks_recording_status`);

    // Restore old schema (optional, depends on migration strategy)
    await queryRunner.query(`
      ALTER TABLE playbacks
      ADD COLUMN recording_id UUID,
      ADD COLUMN user_id UUID,
      ADD COLUMN status VARCHAR(20) DEFAULT 'PAUSED',
      ADD COLUMN position INTEGER DEFAULT 0,
      ADD COLUMN speed INTEGER DEFAULT 1
    `);
  }
}
