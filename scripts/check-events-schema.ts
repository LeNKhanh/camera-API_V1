import AppDataSource from '../src/data-source';

async function checkEventsSchema() {
  await AppDataSource.initialize();

  const columns = await AppDataSource.query(`
    SELECT column_name, data_type, column_default, is_nullable
    FROM information_schema.columns 
    WHERE table_name='events' 
    ORDER BY ordinal_position
  `);

  console.log('📊 Schema bảng events:');
  console.table(columns);

  const sampleData = await AppDataSource.query(`
    SELECT id, camera_id, "nChannelID", type, description, ack, created_at
    FROM events
    ORDER BY created_at DESC
    LIMIT 3
  `);

  console.log('\n📝 Sample data (3 records gần nhất):');
  console.table(sampleData);

  await AppDataSource.destroy();
}

checkEventsSchema().catch(console.error);
