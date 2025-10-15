/**
 * Reset Database Script
 * WARNING: This will DROP ALL TABLES and RESET the migrations table
 * Only use this in development/staging environments
 */

const { execSync } = require('child_process');
require('dotenv').config();

console.log('⚠️  WARNING: This will DROP ALL TABLES in the database!');
console.log('📍 Using DATABASE_URL from environment');

try {
  console.log('\n🔄 Step 1: Dropping all tables...');
  
  // Run the reset script using TypeORM CLI
  execSync(
    'npx typeorm schema:drop -d data-source-prod.js',
    {
      stdio: 'inherit',
      env: process.env,
    }
  );

  console.log('✅ All tables dropped successfully');

  console.log('\n🔄 Step 2: Running migrations...');
  
  execSync(
    'npx typeorm migration:run -d data-source-prod.js',
    {
      stdio: 'inherit',
      env: process.env,
    }
  );

  console.log('\n✅ Database reset complete!');
  console.log('📝 All tables have been recreated with the current schema');

} catch (error) {
  console.error('\n❌ Database reset failed:', error.message);
  console.error('\n💡 Troubleshooting:');
  console.error('   1. Check DATABASE_URL is set correctly');
  console.error('   2. Ensure database is accessible');
  console.error('   3. Check data-source-prod.js exists');
  process.exit(1);
}
