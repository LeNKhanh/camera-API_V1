import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNChannelToEvents1730000001000 implements MigrationInterface {
  name = 'AddNChannelToEvents1730000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add nChannelID column to events table
    await queryRunner.query(`
      ALTER TABLE events
      ADD COLUMN IF NOT EXISTS "nChannelID" INTEGER NOT NULL DEFAULT 1
    `);

    // Update existing events with channel from camera
    await queryRunner.query(`
      UPDATE events e
      SET "nChannelID" = c.channel
      FROM cameras c
      WHERE e.camera_id = c.id
    `);

    // Create index for better query performance
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_events_nchannel ON events("nChannelID")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_events_nchannel`);
    await queryRunner.query(`ALTER TABLE events DROP COLUMN IF EXISTS "nChannelID"`);
  }
}
