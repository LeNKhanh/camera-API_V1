jest.setTimeout(15000);
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/modules/app.module';
import request from 'supertest';
import { existsSync } from 'fs';

describe('Snapshot FAKE (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let camId: string;

  beforeAll(async () => {
    process.env.FAKE_SNAPSHOT_SIZE = '320x240';
    const m = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = m.createNestApplication();
    await app.init();
  // Đăng ký user qua API (role ADMIN)
  await request(app.getHttpServer()).post('/auth/register').send({ username: 'admin', password: 'admin123', role: 'ADMIN' });
  const login = await request(app.getHttpServer()).post('/auth/login').send({ username: 'admin', password: 'admin123' }).expect(200);
    token = login.body.accessToken;
    const cam = await request(app.getHttpServer())
      .post('/cameras')
      .set('Authorization', 'Bearer ' + token)
      .send({ name: 'Snap Cam', ipAddress: '172.16.0.10', port: 37777, username: 'admin', password: 'pass' });
    camId = cam.body.id;
  });

  afterAll(async () => { await app.close(); });

  it('captures fake snapshot file', async () => {
    const res = await request(app.getHttpServer())
      .post('/snapshots/capture')
      .set('Authorization', 'Bearer ' + token)
      .send({ cameraId: camId, strategy: 'FAKE' })
      .expect(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.storagePath).toBeDefined();
    expect(existsSync(res.body.storagePath)).toBe(true);
  });
});
