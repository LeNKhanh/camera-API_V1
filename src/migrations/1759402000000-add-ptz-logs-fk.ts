import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPtzLogsFk1759402000000 implements MigrationInterface {
  name = 'AddPtzLogsFk1759402000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Convert ILoginID từ varchar(64) sang uuid nếu chưa phải uuid
    await queryRunner.query(`
      DO $$ 
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name='ptz_logs' AND column_name='ILoginID' AND data_type='character varying'
        ) THEN
          ALTER TABLE "ptz_logs" 
          ALTER COLUMN "ILoginID" TYPE uuid USING "ILoginID"::uuid;
        END IF;
      END $$;
    `);

    // 2. Kiểm tra và xoá orphan records (ILoginID không tồn tại trong cameras)
    await queryRunner.query(`
      DELETE FROM ptz_logs 
      WHERE "ILoginID" NOT IN (SELECT id FROM cameras)
    `);

    // 3. Thêm index composite trước khi thêm FK (để tăng hiệu năng query)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ptz_logs_iloginid_channel" 
      ON "ptz_logs" ("ILoginID", "nChannelID")
    `);

    // 4. Thêm Foreign Key constraint với CASCADE DELETE
    await queryRunner.query(`
      ALTER TABLE "ptz_logs" 
      ADD CONSTRAINT "FK_ptz_logs_camera" 
      FOREIGN KEY ("ILoginID") 
      REFERENCES "cameras"("id") 
      ON DELETE CASCADE
    `);

    console.log('Added FK constraint ptz_logs.ILoginID → cameras.id with CASCADE DELETE');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Rollback: xoá FK và index
    await queryRunner.query(`
      ALTER TABLE "ptz_logs" 
      DROP CONSTRAINT IF EXISTS "FK_ptz_logs_camera"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_ptz_logs_iloginid_channel"
    `);

    console.log('Removed FK constraint and index from ptz_logs');
  }
}
