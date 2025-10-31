#!/usr/bin/env node
/**
 * Migration script: Replace current ADMIN user with SSO user
 * 
 * Purpose:
 * - Delete old local ADMIN users (username-based auth)
 * - Insert new SSO ADMIN user with id from SSO .sub claim
 * 
 * Usage on production:
 *   node scripts/migrate-sso-admin.js
 * 
 * Environment variables required:
 *   DATABASE_URL or (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME)
 */

require('dotenv').config();
const { Client } = require('pg');

const SSO_ADMIN_ID = 'b6514cad-77d8-4134-80a8-d06bf8644d39';
const SSO_ADMIN_USERNAME = 'sso-admin';
const SSO_ADMIN_ROLE = 'ADMIN';

async function main() {
  const connectionString = process.env.DATABASE_URL || 
    `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'admin'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'Camera_api'}`;

  console.log('🔄 Connecting to database...');
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Step 1: Check if SSO admin already exists
    const checkResult = await client.query(
      'SELECT id, username, role FROM users WHERE id = $1',
      [SSO_ADMIN_ID]
    );

    if (checkResult.rows.length > 0) {
      console.log('✅ SSO admin user already exists:');
      console.log('   ID:', checkResult.rows[0].id);
      console.log('   Username:', checkResult.rows[0].username);
      console.log('   Role:', checkResult.rows[0].role);
      console.log('');
      console.log('ℹ️  No changes needed. SSO admin is ready.');
      return;
    }

    // Step 2: Delete old ADMIN users (local username/password auth)
    console.log('🗑️  Deleting old local ADMIN users...');
    const deleteResult = await client.query(
      "DELETE FROM users WHERE role = 'ADMIN' AND username != $1 RETURNING id, username",
      [SSO_ADMIN_USERNAME]
    );

    if (deleteResult.rowCount > 0) {
      console.log(`   Deleted ${deleteResult.rowCount} old ADMIN user(s):`);
      deleteResult.rows.forEach(row => {
        console.log(`   - ${row.username} (${row.id})`);
      });
    } else {
      console.log('   No old ADMIN users to delete');
    }

    // Step 3: Insert new SSO admin
    console.log('');
    console.log('➕ Creating new SSO admin user...');
    await client.query(
      `INSERT INTO users (id, username, role, password_hash, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())`,
      [
        SSO_ADMIN_ID,
        SSO_ADMIN_USERNAME,
        SSO_ADMIN_ROLE,
        '$2b$10$PLACEHOLDER' // Placeholder hash (SSO users don't use password)
      ]
    );

    console.log('✅ SSO admin user created successfully:');
    console.log('   ID:', SSO_ADMIN_ID);
    console.log('   Username:', SSO_ADMIN_USERNAME);
    console.log('   Role:', SSO_ADMIN_ROLE);
    console.log('');
    console.log('🎉 Migration completed! You can now use SSO token with sub:', SSO_ADMIN_ID);

  } catch (error) {
    console.error('');
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
