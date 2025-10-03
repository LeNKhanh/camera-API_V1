import { MigrationInterface, QueryRunner } from "typeorm";

export class AutoMigration1759291221846 implements MigrationInterface {
    name = 'AutoMigration1759291221846'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ptz_logs" ADD "param1" integer`);
        await queryRunner.query(`ALTER TABLE "ptz_logs" ADD "param2" integer`);
        await queryRunner.query(`ALTER TABLE "ptz_logs" ADD "param3" integer`);
        await queryRunner.query(`ALTER TABLE "ptz_logs" ALTER COLUMN "nChannelID" SET DEFAULT '1'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ptz_logs" ALTER COLUMN "nChannelID" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "ptz_logs" DROP COLUMN "param3"`);
        await queryRunner.query(`ALTER TABLE "ptz_logs" DROP COLUMN "param2"`);
        await queryRunner.query(`ALTER TABLE "ptz_logs" DROP COLUMN "param1"`);
    }

}
