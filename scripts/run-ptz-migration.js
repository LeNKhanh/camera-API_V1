#!/usr/bin/env node
/**
 * Script to run SQL migration 002_update_ptz_logs_schema.sql on production database
 * This fixes the missing columns issue in ptz_logs table
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL environment variable is not set');
  console.error('');
  console.error('Please set DATABASE_URL in your .env file or environment:');
  console.error('  DATABASE_URL=postgresql://user:password@host:port/database');
  console.error('');
  process.exit(1);
}

async function runMigration() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  const migrationFile = path.join(__dirname, '../migrations/002_update_ptz_logs_schema.sql');

  console.log('🔄 Running PTZ Logs Schema Update Migration...');
  console.log('📍 Database:', DATABASE_URL.replace(/:[^:@]+@/, ':****@'));
  console.log('📄 Migration file:', migrationFile);
  console.log('');

  try {
    // Read migration SQL
    if (!fs.existsSync(migrationFile)) {
      throw new Error(`Migration file not found: ${migrationFile}`);
    }

    const sql = fs.readFileSync(migrationFile, 'utf8');

    // Connect to database
    console.log('📡 Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully');
    console.log('');

    // Check current schema
    console.log('🔍 Checking current ptz_logs schema...');
    const checkResult = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'ptz_logs'
      ORDER BY ordinal_position;
    `);

    console.log('Current columns:');
    checkResult.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type}, nullable: ${row.is_nullable})`);
    });
    console.log('');

    // Run migration
    console.log('⚡ Executing migration SQL...');
    await client.query(sql);
    console.log('✅ Migration executed successfully');
    console.log('');

    // Verify updated schema
    console.log('🔍 Verifying updated schema...');
    const verifyResult = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'ptz_logs'
      ORDER BY ordinal_position;
    `);

    console.log('Updated columns:');
    verifyResult.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type}, nullable: ${row.is_nullable})`);
    });
    console.log('');

    // Check for new columns
    const newColumns = ['command_code', 'param1', 'param2', 'param3', 'speed', 'vector_pan', 'vector_tilt', 'vector_zoom', 'duration_ms'];
    const existingColumns = verifyResult.rows.map(r => r.column_name);
    
    const missingColumns = newColumns.filter(col => !existingColumns.includes(col));
    
    if (missingColumns.length > 0) {
      console.warn('⚠️  WARNING: Some columns are still missing:', missingColumns.join(', '));
    } else {
      console.log('✅ All required columns are present!');
    }
    console.log('');

    console.log('🎉 Migration completed successfully!');
    console.log('');
    console.log('📝 Next steps:');
    console.log('   1. Restart your application');
    console.log('   2. Test PTZ commands');
    console.log('   3. Check ptz_logs table for new entries');
    console.log('');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('');
    console.error('Stack trace:');
    console.error(error.stack);
    console.error('');
    console.error('💡 Troubleshooting:');
    console.error('   1. Check DATABASE_URL is correct');
    console.error('   2. Ensure database is accessible');
    console.error('   3. Verify you have ALTER TABLE permissions');
    console.error('   4. Check if ptz_logs table exists');
    console.error('');
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run migration
runMigration();
