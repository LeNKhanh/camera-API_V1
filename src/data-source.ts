import 'dotenv/config';
import { DataSource } from 'typeorm';

// TypeORM DataSource dùng cho CLI (generate/run migrations)
// Ưu tiên DATABASE_URL (từ Coolify) trước, fallback về các biến riêng lẻ
const config = process.env.DATABASE_URL
  ? {
      type: 'postgres' as const,
      url: process.env.DATABASE_URL,
      synchronize: false,
      logging: false,
      entities: ['src/typeorm/entities/*.{ts,js}'],
      migrations: ['src/migrations/*.{ts,js}'],
    }
  : {
      type: 'postgres' as const,
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'Camera_api',
      synchronize: false,
      logging: false,
      entities: ['src/typeorm/entities/*.{ts,js}'],
      migrations: ['src/migrations/*.{ts,js}'],
    };

const AppDataSource = new DataSource(config);

export default AppDataSource;
