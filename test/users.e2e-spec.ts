jest.setTimeout(15000);
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/modules/app.module';
import request from 'supertest';

/**
 * E2E tests for GET /users filters & pagination
 */
describe('Users (e2e) – list filters & pagination', () => {
  let app: INestApplication;
  let adminToken: string;
  const createdUsers: { id: string; username: string; role: string }[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    // Seed admin
    await request(app.getHttpServer()).post('/auth/register').send({ username: 'admin', password: 'admin123', role: 'ADMIN' }).expect(201);
    const login = await request(app.getHttpServer()).post('/auth/login').send({ username: 'admin', password: 'admin123' }).expect(200);
    adminToken = login.body.accessToken;

    // Seed several users
    const matrix = [
      ['opA','OPERATOR'],
      ['opB','OPERATOR'],
      ['viewA','VIEWER'],
      ['viewB','VIEWER'],
      ['root2','ADMIN'],
    ] as const;
    for (const [u, r] of matrix) {
      const reg = await request(app.getHttpServer()).post('/auth/register').send({ username: u, password: 'pass123', role: r }).expect(201);
      createdUsers.push({ id: reg.body.id, username: u, role: r });
      // slight delay to separate createdAt ordering if needed
      await new Promise(res => setTimeout(res, 30));
    }
  });

  afterAll(async () => { await app.close(); });

  it('returns list without pagination (array)', async () => {
    const res = await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', 'Bearer ' + adminToken)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(6); // admin + seeded
  });

  it('filters by username substring (case-insensitive)', async () => {
    const res = await request(app.getHttpServer())
      .get('/users?username=op')
      .set('Authorization', 'Bearer ' + adminToken)
      .expect(200);
    const names = res.body.map((u: any) => u.username);
    expect(names.every((n: string) => n.toLowerCase().includes('op'))).toBe(true);
  });

  it('filters by single role', async () => {
    const res = await request(app.getHttpServer())
      .get('/users?role=VIEWER')
      .set('Authorization', 'Bearer ' + adminToken)
      .expect(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.every((u: any) => u.role === 'VIEWER')).toBe(true);
  });

  it('filters by multi-role', async () => {
    const res = await request(app.getHttpServer())
      .get('/users?role=ADMIN,OPERATOR')
      .set('Authorization', 'Bearer ' + adminToken)
      .expect(200);
  const roles: Set<string> = new Set(res.body.map((u: any) => u.role as string));
    expect(roles.has('ADMIN')).toBe(true);
    expect(roles.has('OPERATOR')).toBe(true);
  expect(Array.from(roles.values()).every((r: string) => ['ADMIN','OPERATOR'].includes(r))).toBe(true);
  });

  it('supports pagination shape', async () => {
    const res = await request(app.getHttpServer())
      .get('/users?page=1&pageSize=2&sortBy=username&sortDir=ASC')
      .set('Authorization', 'Bearer ' + adminToken)
      .expect(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('pagination');
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.pageSize).toBe(2);
    expect(res.body.data.length).toBeLessThanOrEqual(2);
  });
});
