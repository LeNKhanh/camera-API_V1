import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRecordingColumns1729400000000 implements MigrationInterface {
  name = 'AddRecordingColumns1729400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add missing columns to recordings table
    
    // Add duration_sec column
    await queryRunner.query(`
      ALTER TABLE "recordings" 
      ADD COLUMN IF NOT EXISTS "duration_sec" integer NOT NULL DEFAULT 0
    `);

    // Add error_message column
    await queryRunner.query(`
      ALTER TABLE "recordings" 
      ADD COLUMN IF NOT EXISTS "error_message" varchar(255)
    `);

    // Add strategy column
    await queryRunner.query(`
      ALTER TABLE "recordings" 
      ADD COLUMN IF NOT EXISTS "strategy" varchar(20) NOT NULL DEFAULT 'RTSP'
    `);

    // Ensure started_at is NOT NULL with default
    await queryRunner.query(`
      ALTER TABLE "recordings" 
      ALTER COLUMN "started_at" SET NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Rollback: remove added columns
    await queryRunner.query(`ALTER TABLE "recordings" DROP COLUMN IF EXISTS "strategy"`);
    await queryRunner.query(`ALTER TABLE "recordings" DROP COLUMN IF EXISTS "error_message"`);
    await queryRunner.query(`ALTER TABLE "recordings" DROP COLUMN IF EXISTS "duration_sec"`);
  }
}
