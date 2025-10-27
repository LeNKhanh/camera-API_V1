import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTimestampsToPlaybacks1730000004000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add timestamp columns
    await queryRunner.query(`ALTER TABLE playbacks ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ`);
    await queryRunner.query(`ALTER TABLE playbacks ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ`);
    await queryRunner.query(`ALTER TABLE playbacks ADD COLUMN IF NOT EXISTS error_message TEXT`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE playbacks DROP COLUMN IF EXISTS started_at`);
    await queryRunner.query(`ALTER TABLE playbacks DROP COLUMN IF EXISTS ended_at`);
    await queryRunner.query(`ALTER TABLE playbacks DROP COLUMN IF EXISTS error_message`);
  }
}
