import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddEventsNChannel1759403000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('events');
    const hasColumn = table?.columns.find((c) => c.name === 'nChannelID');

    if (!hasColumn) {
      // Thêm cột nChannelID
      await queryRunner.addColumn(
        'events',
        new TableColumn({
          name: 'nChannelID',
          type: 'int',
          isNullable: false,
          default: 1,
        }),
      );

      console.log('✅ Added nChannelID column to events table');

      // Backfill: lấy channel từ cameras nếu có
      await queryRunner.query(`
        UPDATE events e
        SET "nChannelID" = COALESCE(
          (SELECT c.channel FROM cameras c WHERE c.id = e.camera_id LIMIT 1),
          1
        )
      `);

      console.log('✅ Backfilled nChannelID with data from cameras.channel');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('events');
    const hasColumn = table?.columns.find((c) => c.name === 'nChannelID');

    if (hasColumn) {
      await queryRunner.dropColumn('events', 'nChannelID');
      console.log('✅ Dropped nChannelID column from events table');
    }
  }
}
