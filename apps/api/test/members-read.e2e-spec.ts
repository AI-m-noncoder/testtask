import type { INestApplication } from '@nestjs/common';
import {
  as,
  type Client,
  createTestApp,
  type Fixtures,
  fixtures,
  login,
  resetDatabase,
} from './support/helpers.js';

interface Member {
  id: string;
  email: string;
  name: string;
  status: 'active' | 'invited';
  role: { id: string; key: string; level: number };
  branch: { id: string; name: string; address: string | null } | null;
  joinedAt: string;
}
interface Page {
  items: Member[];
  total: number;
  page: number;
  pageSize: number;
}

describe('Organization members: reading (e2e)', () => {
  let app: INestApplication;
  let fx: Fixtures;
  let timur: Client;
  let base: string;

  const list = async (query = '') =>
    (await timur.get(`${base}/users${query}`).expect(200)).body as Page;
  const all = async (query = '') => list(`?pageSize=100${query ? `&${query}` : ''}`);

  beforeAll(async () => {
    app = await createTestApp();
    await resetDatabase(app);
    fx = fixtures(app);
    timur = as(app, await login(app, 'timur@example.com'));
    base = `/organizations/${await fx.orgId('alpha')}`;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('pagination', () => {
    it('returns page metadata and respects pageSize', async () => {
      const page = await list('?pageSize=10');
      expect(page).toMatchObject({ page: 1, pageSize: 10 });
      expect(page.items).toHaveLength(10);
      expect(page.total).toBe(
        await fx.prisma.membership.count({ where: { organization: { name: 'Альфа Логистик' } } }),
      );
    });

    it('pages do not overlap and together cover every member exactly once', async () => {
      const { total } = await list();
      const ids: string[] = [];
      for (let page = 1; page <= Math.ceil(total / 7); page++) {
        ids.push(...(await list(`?pageSize=7&page=${page}`)).items.map((m) => m.id));
      }
      expect(ids).toHaveLength(total);
      expect(new Set(ids).size).toBe(total);
    });

    it('returns an empty page beyond the last one', async () => {
      const page = await list('?page=999');
      expect(page.items).toEqual([]);
      expect(page.total).toBeGreaterThan(0);
    });

    it('defaults to page 1 of 20', async () => {
      expect(await list()).toMatchObject({ page: 1, pageSize: 20 });
    });
  });

  describe('search', () => {
    it('matches name case-insensitively (Cyrillic)', async () => {
      const { items } = await all('search=' + encodeURIComponent('тИМУР'));
      expect(items.map((m) => m.email)).toContain('timur@example.com');
      for (const m of items) expect(`${m.name} ${m.email}`.toLowerCase()).toContain('тимур');
    });

    it('matches email', async () => {
      const { items } = await all('search=tamerlan@');
      expect(items.map((m) => m.email)).toEqual(['tamerlan@example.com']);
    });

    it('treats LIKE wildcards literally', async () => {
      expect((await all('search=%25')).total).toBe(0);
      expect((await all('search=_')).total).toBe(0);
    });

    it('ignores surrounding whitespace', async () => {
      expect((await all('search=%20tamerlan%20')).total).toBe(1);
    });
  });

  describe('filters', () => {
    it('by role', async () => {
      const managerId = await fx.roleId('manager');
      const { items } = await all(`roleId=${managerId}`);
      expect(items.length).toBeGreaterThan(0);
      expect(items.every((m) => m.role.key === 'manager')).toBe(true);
    });

    it('by branch', async () => {
      const [branchId] = await fx.branchIds('alpha');
      const { items } = await all(`branchId=${branchId}`);
      expect(items.length).toBeGreaterThan(0);
      expect(items.every((m) => m.branch?.id === branchId)).toBe(true);
    });

    it('members without a branch (branchId=none)', async () => {
      const { items } = await all('branchId=none');
      expect(items.length).toBeGreaterThan(0);
      expect(items.every((m) => m.branch === null)).toBe(true);
    });

    it('by status', async () => {
      const { items } = await all('status=invited');
      expect(items.length).toBeGreaterThan(0);
      expect(items.every((m) => m.status === 'invited')).toBe(true);
    });

    it('combines filters with search', async () => {
      const adminId = await fx.roleId('admin');
      const { items } = await all(`roleId=${adminId}&search=timur`);
      expect(items.map((m) => m.email)).toEqual(['timur@example.com']);
    });

    it('a branch of another organization matches nothing', async () => {
      const [betaBranch] = await fx.branchIds('beta');
      expect((await all(`branchId=${betaBranch}`)).total).toBe(0);
    });
  });

  describe('sorting', () => {
    const collator = new Intl.Collator('ru');

    it('by name asc / desc', async () => {
      const asc = (await all('sortBy=name&sortOrder=asc')).items.map((m) => m.name);
      const desc = (await all('sortBy=name&sortOrder=desc')).items.map((m) => m.name);
      expect(desc).toEqual([...asc].reverse());
      // Spot-check order: the first name is not after the last one
      expect(collator.compare(asc[0], asc[asc.length - 1])).toBeLessThanOrEqual(0);
    });

    it('by role puts higher roles first when descending', async () => {
      const levels = (await all('sortBy=role&sortOrder=desc')).items.map((m) => m.role.level);
      expect(levels).toEqual([...levels].sort((a, b) => b - a));
      expect(levels[0]).toBe(100);
    });

    it('by join date', async () => {
      const dates = (await all('sortBy=createdAt&sortOrder=asc')).items.map((m) => m.joinedAt);
      expect(dates).toEqual([...dates].sort());
    });
  });

  describe('query validation', () => {
    it.each([
      ['pageSize over the limit', '?pageSize=101'],
      ['page below 1', '?page=0'],
      ['absurdly large page (offset overflow)', '?page=1e20'],
      ['non-numeric page', '?page=abc'],
      ['unknown sort field (no raw column names)', '?sortBy=password_hash'],
      ['bad sort order', '?sortOrder=sideways'],
      ['malformed roleId', '?roleId=1'],
      ['unknown status', '?status=deleted'],
      ['unknown parameter', '?foo=bar'],
    ])('rejects %s with 400', async (_, query) => {
      const res = await timur.get(`${base}/users${query}`).expect(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /users/:userId', () => {
    it('returns the member with role and branch in this organization', async () => {
      const id = await fx.userId('timur@example.com');
      const res = await timur.get(`${base}/users/${id}`).expect(200);
      expect(res.body).toMatchObject({
        id,
        email: 'timur@example.com',
        role: { key: 'admin' },
        status: 'active',
      });
    });

    it('does not expose the member’s other organizations', async () => {
      const res = await timur
        .get(`${base}/users/${await fx.userId('timur@example.com')}`)
        .expect(200);
      expect(JSON.stringify(res.body)).not.toMatch(/Бета|Гамма|Дельта/);
      expect(res.body).not.toHaveProperty('passwordHash');
    });

    it('404 for a user who exists but is a member of another organization only (IDOR)', async () => {
      const aiganymId = await fx.userId('aiganym@example.com');
      const res = await timur.get(`${base}/users/${aiganymId}`).expect(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });

    it('400 for a malformed user id', async () => {
      await timur.get(`${base}/users/123`).expect(400);
    });
  });

  describe('reference data', () => {
    it('roles are marked assignable relative to the caller', async () => {
      const betaTimur = (
        await timur.get(`/organizations/${await fx.orgId('beta')}/roles`).expect(200)
      ).body;
      expect(
        Object.fromEntries(
          betaTimur.map((r: { key: string; assignable: boolean }) => [r.key, r.assignable]),
        ),
      ).toEqual({
        admin: false,
        manager: false,
        employee: true,
      });
    });

    it('branches are limited to the organization', async () => {
      const res = await timur.get(`${base}/branches`).expect(200);
      expect(res.body.map((b: { name: string }) => b.name)).toEqual([
        'Алматы',
        'Астана',
        'Шымкент',
      ]);
    });

    it('branches carry an address and a headcount that matches the branch filter', async () => {
      const branches: Array<{ id: string; address: string; memberCount: number }> = (
        await timur.get(`${base}/branches`).expect(200)
      ).body;
      for (const branch of branches) {
        expect(branch.address).toMatch(/^г\. /);
        expect(branch.memberCount).toBe((await list(`?branchId=${branch.id}`)).total);
      }
      const [member] = (await list(`?branchId=${branches[0].id}&pageSize=1`)).items;
      expect(member.branch).toEqual({
        id: branches[0].id,
        name: 'Алматы',
        address: branches[0].address,
      });
    });
  });
});
