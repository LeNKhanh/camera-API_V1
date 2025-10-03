import { MigrationInterface, QueryRunner } from "typeorm";

export class AutoMigration1759201702915 implements MigrationInterface {
    name = 'AutoMigration1759201702915'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "cameras" ALTER COLUMN "sdk_port" SET DEFAULT '37777'`);
        await queryRunner.query(`ALTER TABLE "cameras" ALTER COLUMN "vendor" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "cameras" ALTER COLUMN "vendor" SET DEFAULT 'dahua'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "cameras" ALTER COLUMN "vendor" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "cameras" ALTER COLUMN "vendor" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "cameras" ALTER COLUMN "sdk_port" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "updated_at"`);
    }

}
