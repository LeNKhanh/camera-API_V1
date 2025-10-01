import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddPtzParams1759401000000 implements MigrationInterface {
  name = 'AddPtzParams1759401000000'
  async up(q: QueryRunner): Promise<void> {
    const cols = await q.getTable('ptz_logs');
    const existing = new Set(cols?.columns.map(c => c.name));
    const add = async (col: TableColumn) => { if (!existing.has(col.name)) await q.addColumn('ptz_logs', col); };
    await add(new TableColumn({ name: 'param1', type: 'int', isNullable: true }));
    await add(new TableColumn({ name: 'param2', type: 'int', isNullable: true }));
    await add(new TableColumn({ name: 'param3', type: 'int', isNullable: true }));
  }
  async down(q: QueryRunner): Promise<void> {
    for (const c of ['param1','param2','param3']) {
      const has = await q.hasColumn('ptz_logs', c); if (has) await q.dropColumn('ptz_logs', c);
    }
  }
}