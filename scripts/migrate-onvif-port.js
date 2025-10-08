// Quick migration script to add onvif_port column
const { Client } = require('pg');

async function migrate() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'Camera_api',
    user: 'postgres',
    password: 'admin', // From .env: DB_PASSWORD=admin
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Add column
    await client.query(`
      ALTER TABLE cameras 
      ADD COLUMN IF NOT EXISTS onvif_port INTEGER DEFAULT 80;
    `);
    console.log('✅ Added onvif_port column');

    // Update existing rows
    const result = await client.query(`
      UPDATE cameras 
      SET onvif_port = 80 
      WHERE onvif_port IS NULL;
    `);
    console.log(`✅ Updated ${result.rowCount} existing cameras`);

    console.log('\n🎉 Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
