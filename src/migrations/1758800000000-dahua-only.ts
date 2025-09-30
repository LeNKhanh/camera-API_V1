import { MigrationInterface, QueryRunner } from 'typeorm';

export class DahuaOnly1758800000000 implements MigrationInterface {
  name = 'DahuaOnly1758800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE "cameras" SET vendor='dahua' WHERE vendor IS NULL OR vendor <> 'dahua'`);
    try { await queryRunner.query(`ALTER TABLE "cameras" ALTER COLUMN "vendor" SET DEFAULT 'dahua'`); } catch {}
    try { await queryRunner.query(`ALTER TABLE "cameras" ALTER COLUMN "sdk_port" SET DEFAULT 37777`); } catch {}
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    try { await queryRunner.query(`ALTER TABLE "cameras" ALTER COLUMN "vendor" DROP DEFAULT`); } catch {}
    try { await queryRunner.query(`ALTER TABLE "cameras" ALTER COLUMN "sdk_port" DROP DEFAULT`); } catch {}
  }
}
