import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
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
  let ivan: Client;

  beforeAll(async () => {
    app = await createTestApp();
    await resetDatabase(app);
    fx = fixtures(app);
    ivan = as(app, await login(app, 'ivan@example.com'));
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
        .send({ email: 'ivan@example.com', password: 'wrong' })
        .expect(401);
      expect(res.body).toEqual({ code: 'UNAUTHORIZED', message: 'Invalid email or password' });
    });

    it('treats email case-insensitively', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: ' Ivan@Example.COM ', password: 'password' })
        .expect(200);
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
      const res = await ivan.get('/me/organizations').expect(200);
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

    it('does not include organizations the user was removed from', async () => {
      const maria = as(app, await login(app, 'maria@example.com'));
      const res = await maria.get('/me/organizations').expect(200);
      expect(res.body.map((o: { name: string }) => o.name)).toEqual(['Бета Ритейл']);
    });
  });

  describe('tenant isolation', () => {
    it('returns 404 (not 403) for an organization the user is not a member of', async () => {
      const maria = as(app, await login(app, 'maria@example.com'));
      const alpha = await fx.orgId('alpha');
      const someone = await fx.memberId('alpha', 'employee');

      for (const req of [
        maria.get(`/organizations/${alpha}/users`),
        maria.get(`/organizations/${alpha}/users/${someone}`),
        maria.post(`/organizations/${alpha}/users`, {
          email: 'x@example.com',
          name: 'X',
          roleId: await fx.roleId('employee'),
        }),
        maria.patch(`/organizations/${alpha}/users/${someone}`, { branchId: null }),
        maria.delete(`/organizations/${alpha}/users/${someone}`),
        maria.get(`/organizations/${alpha}/roles`),
        maria.get(`/organizations/${alpha}/branches`),
      ]) {
        const res = await req;
        expect(res.status).toBe(404);
        expect(res.body.code).toBe('NOT_FOUND');
      }
    });

    it('responds identically for an unknown and for a malformed organization id', async () => {
      const unknown = await ivan
        .get('/organizations/00000000-0000-4000-8000-000000000000/users')
        .expect(404);
      const malformed = await ivan.get('/organizations/not-a-uuid/users').expect(404);
      expect(unknown.body).toEqual(malformed.body);
    });

    it('returns 403 MODULE_DISABLED when the organization has not enabled the users module', async () => {
      // Ivan is an admin in Дельта, so this is purely the module check
      const res = await ivan.get(`/organizations/${await fx.orgId('delta')}/users`).expect(403);
      expect(res.body.code).toBe('MODULE_DISABLED');
    });

    it('stops working immediately after the user is removed from the organization', async () => {
      const alpha = await fx.orgId('alpha');
      const elena = as(app, await login(app, 'elena@example.com'));
      await ivan
        .patch(`/organizations/${alpha}/users/${await fx.userId('elena@example.com')}`, {
          roleId: await fx.roleId('manager'),
        })
        .expect(200);
      await elena.get(`/organizations/${alpha}/users`).expect(200);

      await ivan
        .delete(`/organizations/${alpha}/users/${await fx.userId('elena@example.com')}`)
        .expect(204);
      // Same token, membership gone: access is checked per request, not baked into the JWT
      await elena.get(`/organizations/${alpha}/users`).expect(404);
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
      ivan = as(app, await login(app, 'ivan@example.com'));
    });

    for (const { org, role, allowed } of cases) {
      for (const action of actions) {
        const expected = allowed.includes(action) ? 'allowed' : 'forbidden';

        it(`Ivan as ${role} in ${org}: ${action} is ${expected}`, async () => {
          const orgId = await fx.orgId(org);
          const target = await fx.memberId(org, 'employee');
          const base = `/organizations/${orgId}`;
          const employeeRole = await fx.roleId('employee');

          const res = await {
            list: () => ivan.get(`${base}/users`),
            get: () => ivan.get(`${base}/users/${target}`),
            roles: () => ivan.get(`${base}/roles`),
            create: () =>
              ivan.post(`${base}/users`, {
                email: `new.${org}@example.com`,
                name: 'Новый',
                roleId: employeeRole,
              }),
            update: () => ivan.patch(`${base}/users/${target}`, { branchId: null }),
            delete: () => ivan.delete(`${base}/users/${target}`),
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
