/**
 * Compile TypeScript migrations to JavaScript
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, '..', 'src', 'migrations');
const outputDir = path.join(__dirname, '..', 'dist', 'migrations');

console.log('🔨 Compiling migration files...');

try {
  // Get all .ts migration files
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.ts'))
    .map(file => path.join(migrationsDir, file));

  if (migrationFiles.length === 0) {
    console.log('⚠️  No migration files found in src/migrations/');
    process.exit(0);
  }

  console.log(`📦 Found ${migrationFiles.length} migration file(s):`);
  migrationFiles.forEach(file => {
    console.log(`   - ${path.basename(file)}`);
  });

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Compile each migration file
  migrationFiles.forEach(file => {
    const fileName = path.basename(file, '.ts');
    console.log(`   Compiling ${fileName}...`);
    
    execSync(
      `npx tsc "${file}" --outDir "${outputDir}" --esModuleInterop --skipLibCheck --module commonjs --target es2020`,
      { stdio: 'inherit' }
    );
  });

  console.log('✅ Migrations compiled successfully');

} catch (error) {
  console.error('❌ Migration compilation failed:', error.message);
  process.exit(1);
}
