import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRefreshColumnsAndPtzlogs1758799000000 implements MigrationInterface {
  name = 'AddRefreshColumnsAndPtzlogs1758799000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "refresh_token_hash" varchar(255)`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "refresh_token_exp" timestamptz`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "ptz_logs" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "camera_id" uuid NOT NULL REFERENCES "cameras"(id) ON DELETE CASCADE,
      "action" varchar(40) NOT NULL,
      "speed" int NOT NULL DEFAULT 1,
      "vector_pan" int NOT NULL DEFAULT 0,
      "vector_tilt" int NOT NULL DEFAULT 0,
      "vector_zoom" int NOT NULL DEFAULT 0,
      "duration_ms" int NULL,
      "created_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_ptz_logs_camera_created" ON "ptz_logs" (camera_id, created_at DESC)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "refresh_token_hash"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "refresh_token_exp"`);
    // Không drop bảng ptz_logs để tránh mất dữ liệu lịch sử khi rollback nhỏ.
  }
}
