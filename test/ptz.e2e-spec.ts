jest.setTimeout(15000);
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/modules/app.module';
import request from 'supertest';

describe('PTZ logs (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let camId: string;

  beforeAll(async () => {
    const m = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = m.createNestApplication();
    await app.init();
    // Register and login via API instead of raw SQL seed
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ username: 'admin', password: 'admin123', role: 'ADMIN' })
      .expect(201);
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'admin', password: 'admin123' })
      .expect(200);
    token = login.body.accessToken;
    const cam = await request(app.getHttpServer())
      .post('/cameras')
      .set('Authorization', 'Bearer ' + token)
      .send({ name: 'PTZ Cam', ipAddress: '10.0.0.10', port: 37777, username: 'admin', password: 'pass' });
    camId = cam.body.id;
  });

  afterAll(async () => { await app.close(); });

  it('creates PTZ commands and returns logs', async () => {
    await request(app.getHttpServer())
      .post(`/cameras/${camId}/ptz`)
      .set('Authorization', 'Bearer ' + token)
      .send({ action: 'PAN_LEFT', speed: 2 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/cameras/${camId}/ptz`)
      .set('Authorization', 'Bearer ' + token)
      .send({ action: 'STOP' })
      .expect(201);
    const logs = await request(app.getHttpServer())
      .get(`/cameras/${camId}/ptz/logs`)
      .set('Authorization', 'Bearer ' + token)
      .expect(200);
    expect(Array.isArray(logs.body)).toBe(true);
    expect(logs.body.length).toBeGreaterThanOrEqual(1);
  });
});
