// Script để fix production database - thêm các cột thiếu
// Chạy: node scripts/fix-production-add-columns.js

const { Client } = require('pg');
require('dotenv').config();

const sql = `
-- Thêm các cột thiếu vào bảng ptz_logs
ALTER TABLE ptz_logs ADD COLUMN IF NOT EXISTS command_code integer NOT NULL DEFAULT 0;
ALTER TABLE ptz_logs ADD COLUMN IF NOT EXISTS speed integer NOT NULL DEFAULT 1;
ALTER TABLE ptz_logs ADD COLUMN IF NOT EXISTS vector_pan integer NOT NULL DEFAULT 0;
ALTER TABLE ptz_logs ADD COLUMN IF NOT EXISTS vector_tilt integer NOT NULL DEFAULT 0;
ALTER TABLE ptz_logs ADD COLUMN IF NOT EXISTS vector_zoom integer NOT NULL DEFAULT 0;
ALTER TABLE ptz_logs ADD COLUMN IF NOT EXISTS duration_ms integer;
ALTER TABLE ptz_logs ADD COLUMN IF NOT EXISTS param1 integer;
ALTER TABLE ptz_logs ADD COLUMN IF NOT EXISTS param2 integer;
ALTER TABLE ptz_logs ADD COLUMN IF NOT EXISTS param3 integer;
`;

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🔧 Connecting to production database...');
    await client.connect();
    
    console.log('📝 Adding missing columns to ptz_logs...');
    await client.query(sql);
    
    console.log('✅ Done! Checking schema...');
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'ptz_logs'
      ORDER BY ordinal_position;
    `);
    
    console.log('\n📊 Current ptz_logs schema:');
    console.table(result.rows);
    
    console.log('\n✅ Production database schema fixed successfully!');
    console.log('🚀 PTZ commands should work now.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
