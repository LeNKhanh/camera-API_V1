#!/usr/bin/env node
/**
 * Script to run TypeORM migrations in production
 * This runs before the main app starts
 */

const { execSync } = require('child_process');

console.log('🔄 Running database migrations...');
console.log('📍 Using DATABASE_URL from environment');

try {
  // Run TypeORM migrations
  execSync('npx typeorm migration:run -d dist/data-source.js', { 
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
  console.error('   3. Check dist/data-source.js exists (run build first)');
  console.error('');
  process.exit(1);
}
