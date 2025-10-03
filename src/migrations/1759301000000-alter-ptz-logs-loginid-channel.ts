import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlterPtzLogsLoginIdChannel1759301000000 implements MigrationInterface {
  name = 'AlterPtzLogsLoginIdChannel1759301000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add new columns if not exist
    await queryRunner.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ptz_logs' AND column_name='ILoginID') THEN
        ALTER TABLE "ptz_logs" ADD COLUMN "ILoginID" varchar(64) NULL;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ptz_logs' AND column_name='nChannelID') THEN
        ALTER TABLE "ptz_logs" ADD COLUMN "nChannelID" integer NULL;
      END IF;
    END $$;`);

    // 2. Backfill ILoginID & nChannelID from cameras if camera_id still exists
    await queryRunner.query(`DO $$ DECLARE
      col_exists BOOLEAN;
    BEGIN
      SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ptz_logs' AND column_name='camera_id') INTO col_exists;
      IF col_exists THEN
        UPDATE ptz_logs pl SET
          "ILoginID" = COALESCE(pl."ILoginID", pl.camera_id::text),
          "nChannelID" = COALESCE(pl."nChannelID", c.channel)
        FROM cameras c
        WHERE c.id = pl.camera_id;
      END IF;
    END $$;`);

    // 3. Drop FK & column camera_id if exists
    await queryRunner.query(`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ptz_logs' AND column_name='camera_id') THEN
        ALTER TABLE "ptz_logs" DROP COLUMN "camera_id";
      END IF;
    END $$;`);

    // 4. Ensure not null for ILoginID
  await queryRunner.query(`UPDATE ptz_logs SET "ILoginID" = gen_random_uuid()::text WHERE "ILoginID" IS NULL;`);
  await queryRunner.query(`UPDATE ptz_logs SET "nChannelID" = 1 WHERE "nChannelID" IS NULL;`);
  await queryRunner.query(`ALTER TABLE "ptz_logs" ALTER COLUMN "ILoginID" SET NOT NULL;`);
  await queryRunner.query(`ALTER TABLE "ptz_logs" ALTER COLUMN "nChannelID" SET NOT NULL;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Best effort: cannot restore original camera_id easily.
    // Leave columns as-is; optional revert could be implemented if needed.
  }
}
