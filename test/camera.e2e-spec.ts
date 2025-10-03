jest.setTimeout(15000);
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/modules/app.module';
import request from 'supertest';

describe('Camera (e2e) – Dahua create', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    // Register via API to avoid raw SQL (role ADMIN)
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ username: 'admin', password: 'admin123', role: 'ADMIN' })
      .expect(201);
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'admin', password: 'admin123' })
      .expect(200);
    expect(login.body.accessToken).toBeDefined();
    token = login.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates a Dahua camera with auto rtspUrl', async () => {
    const res = await request(app.getHttpServer())
      .post('/cameras')
      .set('Authorization', 'Bearer ' + token)
      .send({
        name: 'Test Cam',
        ipAddress: '192.168.1.50',
        port: 37777,
        username: 'admin',
        password: 'pass',
      })
      .expect(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.vendor).toBe('dahua');
  });
});
