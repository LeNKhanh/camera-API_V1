const { Client } = require('pg');

async function checkData() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'admin',
    database: 'Camera_api'
  });

  try {
    await client.connect();
    console.log('Connected to database\n');

    // Check ptz_logs table structure
    const structureResult = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'ptz_logs'
      ORDER BY ordinal_position;
    `);
    console.log('ptz_logs table structure:');
    console.table(structureResult.rows);

    // Count rows
    const countResult = await client.query('SELECT COUNT(*) as count FROM ptz_logs');
    console.log(`\nTotal ptz_logs entries: ${countResult.rows[0].count}`);

    const cameraCountResult = await client.query('SELECT COUNT(*) as count FROM cameras');
    console.log(`Total cameras: ${cameraCountResult.rows[0].count}`);

    // Check ptz_logs ILoginID values
    const ptzResult = await client.query('SELECT "ILoginID", "nChannelID", action, created_at FROM ptz_logs ORDER BY created_at DESC LIMIT 5');
    if (ptzResult.rows.length > 0) {
      console.log('\nRecent ptz_logs entries:');
      console.table(ptzResult.rows);
    }

    // Check cameras ids
    const cameraResult = await client.query('SELECT id, name, ip_address FROM cameras LIMIT 5');
    if (cameraResult.rows.length > 0) {
      console.log('\nCameras:');
      console.table(cameraResult.rows);
    }

    // Check existing constraints
    const constraintResult = await client.query(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'ptz_logs';
    `);
    console.log('\nExisting constraints on ptz_logs:');
    console.table(constraintResult.rows);

  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await client.end();
  }
}

checkData();
