// Script để check event table schema
import AppDataSource from './src/data-source';

async function checkSchema() {
  try {
    await AppDataSource.initialize();
    const queryRunner = AppDataSource.createQueryRunner();
    
    const result = await queryRunner.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'events' 
      ORDER BY ordinal_position;
    `);
    
    console.log('\n=== EVENTS TABLE SCHEMA ===');
    console.table(result);
    
    await queryRunner.release();
    await AppDataSource.destroy();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkSchema();
