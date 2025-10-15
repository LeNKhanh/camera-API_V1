/**
 * Production DataSource for TypeORM CLI (CommonJS format)
 * This file is used by migration scripts in production
 */

require('dotenv/config');
const { DataSource } = require('typeorm');

// Build config based on DATABASE_URL or individual vars
const config = process.env.DATABASE_URL
  ? {
      type: 'postgres',
      url: process.env.DATABASE_URL,
      synchronize: false,
      logging: true, // Enable logging for migrations
      entities: ['dist/typeorm/entities/*.js'],
      migrations: ['dist/migrations/*.js'],
    }
  : {
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'Camera_api',
      synchronize: false,
      logging: true, // Enable logging for migrations
      entities: ['dist/typeorm/entities/*.js'],
      migrations: ['dist/migrations/*.js'],
    };

const AppDataSource = new DataSource(config);

module.exports = AppDataSource;
