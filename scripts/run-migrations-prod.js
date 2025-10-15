#!/usr/bin/env node
/**
 * Script to run TypeORM migrations in production
 * This runs before the main app starts
 */

const { execSync } = require('child_process');

console.log('🔄 Running database migrations...');
console.log('📍 Using DATABASE_URL from environment');

try {
  // Run TypeORM migrations using production data source
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
