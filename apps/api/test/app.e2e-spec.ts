import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './support/helpers.js';

describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health is public', () => {
    return request(app.getHttpServer()).get('/api/health').expect(200, { status: 'ok' });
  });
});
