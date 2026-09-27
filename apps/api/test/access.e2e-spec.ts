import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { LoginThrottleService } from '../src/auth/login-throttle.service.js';
import {
  as,
  type Client,
  createTestApp,
  type Fixtures,
  fixtures,
  login,
  type OrgName,
  resetDatabase,
} from './support/helpers.js';

describe('Authentication and organization access (e2e)', () => {
  let app: INestApplication;
  let fx: Fixtures;
  let timur: Client;

  beforeAll(async () => {
    app = await createTestApp();
    await resetDatabase(app);
    fx = fixtures(app);
    timur = as(app, await login(app, 'timur@example.com'));
  });

  afterAll(async () => {
    await app.close();
  });

  describe('authentication', () => {
    it('rejects requests without a token', async () => {
      const res = await request(app.getHttpServer()).get('/api/me').expect(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    it('rejects an invalid token', async () => {
      await as(app, 'not-a-jwt').get('/me').expect(401);
    });

    it('rejects a wrong password with a generic message', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'timur@example.com', password: 'wrong' })
        .expect(401);
      expect(res.body).toEqual({ code: 'UNAUTHORIZED', message: 'Invalid email or password' });
    });

    it('treats email case-insensitively', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: ' Timur@Example.COM ', password: 'password' })
        .expect(200);
    });

    it('throttles repeated failed logins for an email, without blocking other emails', async () => {
      const attempt = (email: string, password: string) =>
        request(app.getHttpServer()).post('/api/auth/login').send({ email, password });

      for (let i = 0; i < 5; i++) await attempt('aiganym@example.com', 'wrong').expect(401);
      const blocked = await attempt('aiganym@example.com', 'password').expect(429);
      expect(blocked.body.code).toBe('TOO_MANY_REQUESTS');
      expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);

      await attempt('rustem@example.com', 'password').expect(200);
      // Unblock for the tests below that log in as Айганым
      app.get(LoginThrottleService).reset('aiganym@example.com');
    });

    it('returns 413 with the common error shape for an oversized body', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'a'.repeat(200_000), password: 'x' })
        .expect(413);
      expect(res.body.code).toBe('PAYLOAD_TOO_LARGE');
    });

    it('does not advertise the server framework', async () => {
      const res = await request(app.getHttpServer()).get('/api/health').expect(200);
      expect(res.headers['x-powered-by']).toBeUndefined();
    });

    it('does not let invited users (no password yet) log in', async () => {
      const invited = await fx.prisma.user.findFirstOrThrow({ where: { passwordHash: null } });
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: invited.email, password: 'password' })
        .expect(401);
    });
  });

  describe('GET /me/organizations', () => {
    it('lists only the organizations the user belongs to, with the role in each', async () => {
      const res = await timur.get('/me/organizations').expect(200);
      const summary = Object.fromEntries(
        res.body.map((o: { name: string; role: { key: string } }) => [o.name, o.role.key]),
      );
      expect(summary).toEqual({
        'Альфа Логистик': 'admin',
        'Бета Ритейл': 'manager',
        'Гамма Строй': 'employee',
        'Дельта Консалтинг': 'admin',
      });
    });

    it('describes each organization with its own branches only', async () => {
      const res = await timur.get('/me/organizations').expect(200);
      const alpha = res.body.find((o: { name: string }) => o.name === 'Альфа Логистик');
      expect(alpha.description).toMatch(/логистика/);
      expect(alpha.branches.map((b: { name: string }) => b.name)).toEqual([
        'Алматы',
        'Астана',
        'Шымкент',
      ]);
      expect(alpha.branches[0].address).toMatch(/^г\. Алматы/);
    });

    it('does not include organizations the user was removed from', async () => {
      const aiganym = as(app, await login(app, 'aiganym@example.com'));
      const res = await aiganym.get('/me/organizations').expect(200);
      expect(res.body.map((o: { name: string }) => o.name)).toEqual(['Бета Ритейл']);
    });
  });

  describe('tenant isolation', () => {
    it('returns 404 (not 403) for an organization the user is not a member of', async () => {
      const aiganym = as(app, await login(app, 'aiganym@example.com'));
      const alpha = await fx.orgId('alpha');
      const someone = await fx.memberId('alpha', 'employee');

      for (const req of [
        aiganym.get(`/organizations/${alpha}/users`),
        aiganym.get(`/organizations/${alpha}/users/${someone}`),
        aiganym.post(`/organizations/${alpha}/users`, {
          email: 'x@example.com',
          name: 'X',
          roleId: await fx.roleId('employee'),
        }),
        aiganym.patch(`/organizations/${alpha}/users/${someone}`, { branchId: null }),
        aiganym.delete(`/organizations/${alpha}/users/${someone}`),
        aiganym.get(`/organizations/${alpha}/roles`),
        aiganym.get(`/organizations/${alpha}/branches`),
      ]) {
        const res = await req;
        expect(res.status).toBe(404);
        expect(res.body.code).toBe('NOT_FOUND');
      }
    });

    it('responds identically for an unknown and for a malformed organization id', async () => {
      const unknown = await timur
        .get('/organizations/00000000-0000-4000-8000-000000000000/users')
        .expect(404);
      const malformed = await timur.get('/organizations/not-a-uuid/users').expect(404);
      expect(unknown.body).toEqual(malformed.body);
    });

    it('returns 403 MODULE_DISABLED when the organization has not enabled the users module', async () => {
      // Timur is an admin in Дельта, so this is purely the module check
      const res = await timur.get(`/organizations/${await fx.orgId('delta')}/users`).expect(403);
      expect(res.body.code).toBe('MODULE_DISABLED');
    });

    it('stops working immediately after the user is removed from the organization', async () => {
      const alpha = await fx.orgId('alpha');
      const tamerlan = as(app, await login(app, 'tamerlan@example.com'));
      await timur
        .patch(`/organizations/${alpha}/users/${await fx.userId('tamerlan@example.com')}`, {
          roleId: await fx.roleId('manager'),
        })
        .expect(200);
      await tamerlan.get(`/organizations/${alpha}/users`).expect(200);

      await timur
        .delete(`/organizations/${alpha}/users/${await fx.userId('tamerlan@example.com')}`)
        .expect(204);
      // Same token, membership gone: access is checked per request, not baked into the JWT
      await tamerlan.get(`/organizations/${alpha}/users`).expect(404);
    });
  });

  describe('permission matrix: the same account, different role per organization', () => {
    type Action = 'list' | 'get' | 'roles' | 'create' | 'update' | 'delete';
    const cases: Array<{ org: OrgName; role: string; allowed: Action[] }> = [
      {
        org: 'alpha',
        role: 'admin',
        allowed: ['list', 'get', 'roles', 'create', 'update', 'delete'],
      },
      { org: 'beta', role: 'manager', allowed: ['list', 'get', 'roles', 'create', 'update'] },
      { org: 'gamma', role: 'employee', allowed: [] },
    ];
    const actions: Action[] = ['list', 'get', 'roles', 'create', 'update', 'delete'];

    beforeAll(async () => {
      await resetDatabase(app);
      // Reseeding recreates users with new ids, so the old token belongs to a deleted account
      timur = as(app, await login(app, 'timur@example.com'));
    });

    for (const { org, role, allowed } of cases) {
      for (const action of actions) {
        const expected = allowed.includes(action) ? 'allowed' : 'forbidden';

        it(`Timur as ${role} in ${org}: ${action} is ${expected}`, async () => {
          const orgId = await fx.orgId(org);
          const target = await fx.memberId(org, 'employee');
          const base = `/organizations/${orgId}`;
          const employeeRole = await fx.roleId('employee');

          const res = await {
            list: () => timur.get(`${base}/users`),
            get: () => timur.get(`${base}/users/${target}`),
            roles: () => timur.get(`${base}/roles`),
            create: () =>
              timur.post(`${base}/users`, {
                email: `new.${org}@example.com`,
                name: 'Новый',
                roleId: employeeRole,
              }),
            update: () => timur.patch(`${base}/users/${target}`, { branchId: null }),
            delete: () => timur.delete(`${base}/users/${target}`),
          }[action]();

          if (expected === 'allowed') {
            expect(res.status).toBeGreaterThanOrEqual(200);
            expect(res.status).toBeLessThan(300);
          } else {
            expect(res.status).toBe(403);
            expect(res.body.code).toBe('FORBIDDEN');
          }
        });
      }
    }
  });
});
