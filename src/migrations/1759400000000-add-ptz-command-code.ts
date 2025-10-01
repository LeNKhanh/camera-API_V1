import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddPtzCommandCode1759400000000 implements MigrationInterface {
  name = 'AddPtzCommandCode1759400000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasCol = await queryRunner.hasColumn('ptz_logs','command_code');
    if (!hasCol) {
      await queryRunner.addColumn('ptz_logs', new TableColumn({
        name: 'command_code',
        type: 'int',
        isNullable: false,
        default: 0,
      }));
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasCol = await queryRunner.hasColumn('ptz_logs','command_code');
    if (hasCol) {
      await queryRunner.dropColumn('ptz_logs','command_code');
    }
  }
}
