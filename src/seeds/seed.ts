import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

import { User } from '../typeorm/entities/user.entity';
import { Camera } from '../typeorm/entities/camera.entity';
import { Recording } from '../typeorm/entities/recording.entity';
import { Event } from '../typeorm/entities/event.entity';
import { Snapshot } from '../typeorm/entities/snapshot.entity';

dotenv.config();

// DataSource tạm để seed nhanh (dùng cùng config với AppModule)
const dsConfig: any = process.env.DATABASE_URL
  ? {
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [User, Camera, Recording, Event, Snapshot],
      synchronize: false, // Use migrations in production
    }
  : {
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'Camera_api',
      entities: [User, Camera, Recording, Event, Snapshot],
      synchronize: false, // Use migrations instead
    };

const ds = new DataSource(dsConfig);

async function main() {
  await ds.initialize();
  const userRepo = ds.getRepository(User);

  // Tạo admin mặc định nếu chưa có
  const exists = await userRepo.findOne({ where: { username: 'admin' } });
  if (!exists) {
    const u = userRepo.create({ username: 'admin', passwordHash: await bcrypt.hash('admin123', 10), role: 'ADMIN' });
    await userRepo.save(u);
    console.log('Seeded admin: admin/admin123');
  } else {
    console.log('Admin existed');
  }

  await ds.destroy();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
