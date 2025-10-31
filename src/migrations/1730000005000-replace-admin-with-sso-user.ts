import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Replace local ADMIN users with SSO admin user
 * 
 * Purpose:
 * - Delete old local ADMIN users (username/password auth)
 * - Insert new SSO ADMIN user with id from SSO .sub claim
 * 
 * This runs automatically on deployment via npm run migration:run
 */
export class ReplaceAdminWithSsoUser1730000005000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const SSO_ADMIN_ID = 'b6514cad-77d8-4134-80a8-d06bf8644d39';
    const SSO_ADMIN_USERNAME = 'sso-admin';
    const SSO_ADMIN_ROLE = 'ADMIN';

    // Step 1: Check if SSO admin already exists
    const existing = await queryRunner.query(
      `SELECT id FROM users WHERE id = $1`,
      [SSO_ADMIN_ID]
    );

    if (existing.length > 0) {
      console.log('✅ SSO admin user already exists, skipping migration');
      return;
    }

    // Step 2: Delete old local ADMIN users
    console.log('🗑️  Deleting old local ADMIN users...');
    const deleted = await queryRunner.query(
      `DELETE FROM users WHERE role = 'ADMIN' RETURNING id, username`
    );

    if (deleted.length > 0) {
      console.log(`   Deleted ${deleted.length} old ADMIN user(s):`);
      deleted.forEach((row: any) => {
        console.log(`   - ${row.username} (${row.id})`);
      });
    }

    // Step 3: Insert new SSO admin user
    console.log('➕ Creating new SSO admin user...');
    await queryRunner.query(
      `INSERT INTO users (id, username, role, password_hash, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())`,
      [
        SSO_ADMIN_ID,
        SSO_ADMIN_USERNAME,
        SSO_ADMIN_ROLE,
        '$2b$10$PLACEHOLDER' // Placeholder hash (SSO users don't use password)
      ]
    );

    console.log('✅ SSO admin user created successfully');
    console.log('   ID:', SSO_ADMIN_ID);
    console.log('   Username:', SSO_ADMIN_USERNAME);
    console.log('   Role:', SSO_ADMIN_ROLE);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Rollback: Delete SSO admin and restore a default local admin
    const SSO_ADMIN_ID = 'b6514cad-77d8-4134-80a8-d06bf8644d39';

    console.log('⏮️  Rolling back: Deleting SSO admin user...');
    await queryRunner.query(`DELETE FROM users WHERE id = $1`, [SSO_ADMIN_ID]);

    console.log('⏮️  Restoring default local admin user...');
    const bcrypt = require('bcrypt');
    const passwordHash = await bcrypt.hash('admin123', 10);

    await queryRunner.query(
      `INSERT INTO users (username, role, password_hash, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())`,
      ['admin', 'ADMIN', passwordHash]
    );

    console.log('✅ Rollback completed: local admin restored (username: admin, password: admin123)');
  }
}
