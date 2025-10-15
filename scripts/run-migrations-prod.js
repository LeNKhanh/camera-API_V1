#!/usr/bin/env node
/**
 * Script to run TypeORM migrations AND SQL migrations in production
 * This runs before the main app starts
 */

const { execSync } = require('child_process');
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

console.log('🔄 Running database migrations...');
console.log('📍 Using DATABASE_URL from environment');
console.log('');

async function runSQLMigrations() {
  const sqlDir = path.join(__dirname, '../migrations');
  
  // Kiểm tra thư mục migrations có tồn tại không
  if (!fs.existsSync(sqlDir)) {
    console.log('📁 No migrations folder found, skipping SQL migrations');
    return;
  }

  // Lấy tất cả file .sql
  const files = fs.readdirSync(sqlDir)
    .filter(f => f.endsWith('.sql'))
    .sort(); // Sắp xếp theo tên file (001_, 002_, etc.)

  if (files.length === 0) {
    console.log('📁 No SQL migration files found');
    return;
  }

  console.log(`📄 Found ${files.length} SQL migration file(s)`);
  console.log('');

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Tạo bảng để track SQL migrations đã chạy
    await client.query(`
      CREATE TABLE IF NOT EXISTS sql_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT NOW()
      )
    `);

    for (const file of files) {
      // Kiểm tra xem migration này đã chạy chưa
      const checkResult = await client.query(
        'SELECT filename FROM sql_migrations WHERE filename = $1',
        [file]
      );

      if (checkResult.rows.length > 0) {
        console.log(`⏭️  Skipping ${file} (already executed)`);
        continue;
      }

      console.log(`⚡ Running SQL migration: ${file}`);
      const sql = fs.readFileSync(path.join(sqlDir, file), 'utf8');
      
      try {
        await client.query(sql);
        
        // Đánh dấu migration đã chạy
        await client.query(
          'INSERT INTO sql_migrations (filename) VALUES ($1)',
          [file]
        );
        
        console.log(`✅ ${file} completed`);
      } catch (sqlError) {
        console.error(`❌ Error in ${file}:`, sqlError.message);
        // Tiếp tục với migration tiếp theo thay vì dừng hẳn
        if (sqlError.message.includes('already exists') || 
            sqlError.message.includes('does not exist')) {
          console.log(`⚠️  Non-critical error, continuing...`);
        } else {
          throw sqlError;
        }
      }
    }

    console.log('✅ All SQL migrations completed');
    console.log('');

  } catch (error) {
    console.error('❌ SQL Migration error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

async function main() {
  try {
    // 1. Run TypeORM migrations first
    console.log('1️⃣  Running TypeORM migrations...');
    execSync('npx typeorm migration:run -d data-source-prod.js', { 
      stdio: 'inherit',
      env: process.env 
    });
    console.log('✅ TypeORM migrations completed');
    console.log('');

    // 2. Run SQL migrations
    console.log('2️⃣  Running SQL migrations...');
    await runSQLMigrations();

    console.log('');
    console.log('🎉 All migrations completed successfully!');
    console.log('');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('');
    console.error('💡 Troubleshooting:');
    console.error('   1. Check DATABASE_URL is set correctly');
    console.error('   2. Ensure database is accessible');
    console.error('   3. Check data-source-prod.js exists');
    console.error('   4. Verify dist/ folder has compiled migrations');
    console.error('   5. Check migrations/*.sql files are valid');
    console.error('');
    process.exit(1);
  }
}

main();
