import { MigrationInterface, QueryRunner } from "typeorm";

export class AutoMigration1758794190088 implements MigrationInterface {
    name = 'AutoMigration1758794190088'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "cameras" ADD "sdk_port" integer`);
        await queryRunner.query(`ALTER TABLE "cameras" ADD "vendor" character varying(50)`);
        await queryRunner.query(`ALTER TABLE "recordings" ALTER COLUMN "status" SET DEFAULT 'PENDING'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "recordings" ALTER COLUMN "status" SET DEFAULT 'COMPLETED'`);
        await queryRunner.query(`ALTER TABLE "cameras" DROP COLUMN "vendor"`);
        await queryRunner.query(`ALTER TABLE "cameras" DROP COLUMN "sdk_port"`);
    }

}
