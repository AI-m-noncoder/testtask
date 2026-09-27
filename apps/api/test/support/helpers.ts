import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DEMO_PASSWORD, seed } from '../../prisma/seed-data.js';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

export const ORG = {
  alpha: 'Альфа Логистик',
  beta: 'Бета Ритейл',
  gamma: 'Гамма Строй',
  delta: 'Дельта Консалтинг',
} as const;
export type OrgName = keyof typeof ORG;

export async function createTestApp() {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ logger: ['error'] });
  configureApp(app);
  // Listen once on a random port: supertest reuses it instead of starting a server per request
  await app.listen(0);
  return app;
}

/** Wipes the test database and reseeds demo data. Refuses to touch a non-test database. */
export async function resetDatabase(app: INestApplication) {
  const prisma = app.get(PrismaService);
  const [{ db }] = await prisma.$queryRaw<[{ db: string }]>`SELECT current_database() AS db`;
  if (!db.endsWith('_test')) {
    throw new Error(`Refusing to reset "${db}": e2e tests only run against a *_test database`);
  }
  await prisma.$executeRaw`TRUNCATE users, organizations, roles, permissions CASCADE`;
  await seed(prisma);
}

export async function login(app: INestApplication, email: string, password = DEMO_PASSWORD) {
  const res = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email, password })
    .expect(200);
  return res.body.accessToken as string;
}

/** Supertest bound to a user's token */
export function as(app: INestApplication, token: string) {
  const server = app.getHttpServer();
  const auth = { Authorization: `Bearer ${token}` };
  return {
    get: (url: string) => request(server).get(`/api${url}`).set(auth),
    post: (url: string, body?: object) => request(server).post(`/api${url}`).set(auth).send(body),
    patch: (url: string, body?: object) => request(server).patch(`/api${url}`).set(auth).send(body),
    delete: (url: string) => request(server).delete(`/api${url}`).set(auth),
  };
}
export type Client = ReturnType<typeof as>;

/** Looks up seeded ids directly in the database */
export function fixtures(app: INestApplication) {
  const prisma = app.get(PrismaService);
  return {
    prisma,
    orgId: async (org: OrgName) =>
      (await prisma.organization.findFirstOrThrow({ where: { name: ORG[org] } })).id,
    roleId: async (key: string) =>
      (await prisma.role.findFirstOrThrow({ where: { key, organizationId: null } })).id,
    branchIds: async (org: OrgName) =>
      (
        await prisma.branch.findMany({
          where: { organization: { name: ORG[org] } },
          orderBy: { name: 'asc' },
        })
      ).map((b) => b.id),
    userId: async (email: string) => (await prisma.user.findUniqueOrThrow({ where: { email } })).id,
    /** Some active member of the organization with the given role (not one of the demo accounts) */
    memberId: async (org: OrgName, roleKey: string) =>
      (
        await prisma.membership.findFirstOrThrow({
          where: {
            organization: { name: ORG[org] },
            role: { key: roleKey },
            deletedAt: null,
            status: 'ACTIVE',
            user: {
              email: {
                notIn: [
                  'timur@example.com',
                  'aiganym@example.com',
                  'rustem@example.com',
                  'tamerlan@example.com',
                ],
              },
            },
          },
          orderBy: { user: { email: 'asc' } },
        })
      ).userId,
  };
}
export type Fixtures = ReturnType<typeof fixtures>;
