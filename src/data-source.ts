import 'dotenv/config';
import { DataSource } from 'typeorm';

// TypeORM DataSource dùng cho CLI (generate/run migrations)
const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'Camera_api',
  synchronize: false,
  logging: false,
  entities: ['src/typeorm/entities/*.{ts,js}'],
  migrations: ['src/migrations/*.{ts,js}'],
});

export default AppDataSource;
