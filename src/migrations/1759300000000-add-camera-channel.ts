import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCameraChannel1759300000000 implements MigrationInterface {
  name = 'AddCameraChannel1759300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add channel column if not exists (Postgres syntax); ignore errors if rerun
    await queryRunner.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cameras' AND column_name='channel') THEN
        ALTER TABLE "cameras" ADD COLUMN "channel" integer NOT NULL DEFAULT 1;
      END IF;
    END $$;`);
    // Drop old unique on ip_address if exists
    await queryRunner.query(`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename='cameras' AND indexname='IDX_unique_ip_address') THEN
        DROP INDEX IF EXISTS "IDX_unique_ip_address";
      END IF;
    END $$;`);
    // Create composite unique (ip_address, channel)
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_cameras_ip_channel" ON "cameras" ("ip_address", "channel");`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_cameras_ip_channel";`);
    // Keep channel column (non-destructive). If needed:
    // ALTER TABLE "cameras" DROP COLUMN "channel";
  }
}
