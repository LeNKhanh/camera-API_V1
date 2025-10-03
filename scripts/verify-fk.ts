import AppDataSource from '../src/data-source';

async function verifyFK() {
  await AppDataSource.initialize();

  const result = await AppDataSource.query(`
    SELECT 
      tc.table_name, 
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      rc.delete_rule
    FROM information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints AS rc
      ON rc.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' 
      AND tc.table_name = 'ptz_logs'
      AND kcu.column_name = 'ILoginID'
  `);

  console.log('📊 Foreign Key Constraint on ptz_logs:');
  console.table(result);

  // Check index
  const indexes = await AppDataSource.query(`
    SELECT 
      indexname,
      indexdef
    FROM pg_indexes
    WHERE tablename = 'ptz_logs'
      AND indexname LIKE '%iloginid%'
  `);

  console.log('\n📑 Indexes on ILoginID:');
  console.table(indexes);

  await AppDataSource.destroy();
}

verifyFK().catch(console.error);
