#!/usr/bin/env node
/**
 * Script to run TypeORM migrations in production
 * This runs before the main app starts
 */

const { execSync } = require('child_process');
const { Client } = require('pg');

async function fixPtzLogsSchema() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    
    // Check if ptz_logs table exists and missing columns
    const checkResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'ptz_logs' AND column_name = 'command_code'
    `);
    
    if (checkResult.rows.length === 0) {
      console.log('🔧 Fixing ptz_logs schema (adding missing columns)...');
      
      await client.query(`
        ALTER TABLE ptz_logs ADD COLUMN IF NOT EXISTS command_code integer NOT NULL DEFAULT 0;
        ALTER TABLE ptz_logs ADD COLUMN IF NOT EXISTS speed integer NOT NULL DEFAULT 1;
        ALTER TABLE ptz_logs ADD COLUMN IF NOT EXISTS vector_pan integer NOT NULL DEFAULT 0;
        ALTER TABLE ptz_logs ADD COLUMN IF NOT EXISTS vector_tilt integer NOT NULL DEFAULT 0;
        ALTER TABLE ptz_logs ADD COLUMN IF NOT EXISTS vector_zoom integer NOT NULL DEFAULT 0;
        ALTER TABLE ptz_logs ADD COLUMN IF NOT EXISTS duration_ms integer;
        ALTER TABLE ptz_logs ADD COLUMN IF NOT EXISTS param1 integer;
        ALTER TABLE ptz_logs ADD COLUMN IF NOT EXISTS param2 integer;
        ALTER TABLE ptz_logs ADD COLUMN IF NOT EXISTS param3 integer;
      `);
      
      console.log('✅ ptz_logs schema fixed successfully!');
    } else {
      console.log('✓ ptz_logs schema is up to date');
    }
    
    await client.end();
  } catch (error) {
    console.warn('⚠️  Could not check/fix ptz_logs schema:', error.message);
    try { await client.end(); } catch {}
  }
}

async function main() {
  console.log('🔄 Running database migrations...');
  console.log('📍 Using DATABASE_URL from environment');

  try {
    // Step 1: Fix ptz_logs schema if needed (for existing deployments)
    await fixPtzLogsSchema();
    
    // Step 2: Run TypeORM migrations using production data source
    execSync('npx typeorm migration:run -d data-source-prod.js', { 
      stdio: 'inherit',
      env: process.env 
    });
    
    console.log('✅ Migrations completed successfully');
    console.log('');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('');
    console.error('💡 Troubleshooting:');
    console.error('   1. Check DATABASE_URL is set correctly');
    console.error('   2. Ensure database is accessible');
    console.error('   3. Check data-source-prod.js exists');
    console.error('   4. Verify dist/ folder has compiled migrations');
    console.error('');
    process.exit(1);
  }
}

main();

