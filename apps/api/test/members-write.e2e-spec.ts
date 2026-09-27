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

describe('Organization members: changes and edge cases (e2e)', () => {
  let app: INestApplication;
  let fx: Fixtures;
  /** Admin in Альфа, manager in Бета */
  let timur: Client;
  let alpha: string;
  let beta: string;
  let roles: Record<'admin' | 'manager' | 'employee', string>;

  beforeAll(async () => {
    app = await createTestApp();
    fx = fixtures(app);
  });

  // Every test starts from the same seeded state
  beforeEach(async () => {
    await resetDatabase(app);
    timur = as(app, await login(app, 'timur@example.com'));
    alpha = `/organizations/${await fx.orgId('alpha')}`;
    beta = `/organizations/${await fx.orgId('beta')}`;
    roles = {
      admin: await fx.roleId('admin'),
      manager: await fx.roleId('manager'),
      employee: await fx.roleId('employee'),
    };
  });

  afterAll(async () => {
    await app.close();
  });

  const membershipsOf = (email: string) =>
    fx.prisma.membership.findMany({ where: { user: { email } }, include: { organization: true } });

  describe('POST /users — add a member', () => {
    it('creates an invited account for a new email', async () => {
      const [branchId] = await fx.branchIds('alpha');
      const res = await timur
        .post(`${alpha}/users`, {
          email: '  New.Person@Example.com ',
          name: 'Новый Человек',
          roleId: roles.employee,
          branchId,
        })
        .expect(201);

      expect(res.body).toMatchObject({
        email: 'new.person@example.com',
        name: 'Новый Человек',
        status: 'invited',
        role: { key: 'employee' },
        branch: { id: branchId },
      });
      await timur.get(`${alpha}/users/${res.body.id}`).expect(200);
    });

    it('requires a name when the email has no account yet', async () => {
      const res = await timur
        .post(`${alpha}/users`, { email: 'nobody@example.com', roleId: roles.employee })
        .expect(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('links an existing account instead of creating a duplicate, without renaming it', async () => {
      const aiganymId = await fx.userId('aiganym@example.com');
      const res = await timur
        .post(`${alpha}/users`, {
          email: 'aiganym@example.com',
          name: 'Другое Имя',
          roleId: roles.employee,
        })
        .expect(201);

      expect(res.body).toMatchObject({
        id: aiganymId,
        name: 'Айганым Нурланова',
        status: 'active',
      });
      expect(await fx.prisma.user.count({ where: { email: 'aiganym@example.com' } })).toBe(1);
      expect(
        (await membershipsOf('aiganym@example.com')).map((m) => m.organization.name).sort(),
      ).toEqual(['Альфа Логистик', 'Бета Ритейл']);
    });

    it('409 ALREADY_MEMBER when the person is already in the organization', async () => {
      const res = await timur
        .post(`${alpha}/users`, { email: 'tamerlan@example.com', roleId: roles.employee })
        .expect(409);
      expect(res.body.code).toBe('ALREADY_MEMBER');
    });

    it('restores a previously removed member instead of failing on the unique key', async () => {
      const tamerlanId = await fx.userId('tamerlan@example.com');
      await timur.delete(`${alpha}/users/${tamerlanId}`).expect(204);

      const res = await timur
        .post(`${alpha}/users`, { email: 'tamerlan@example.com', roleId: roles.manager })
        .expect(201);
      expect(res.body).toMatchObject({
        id: tamerlanId,
        role: { key: 'manager' },
        status: 'active',
      });
      // Same row reused
      expect(await fx.prisma.membership.count({ where: { userId: tamerlanId } })).toBe(1);
    });

    it('400 for a branch of another organization', async () => {
      const [betaBranch] = await fx.branchIds('beta');
      const res = await timur
        .post(`${alpha}/users`, {
          email: 'x@example.com',
          name: 'X',
          roleId: roles.employee,
          branchId: betaBranch,
        })
        .expect(400);
      expect(res.body.message).toBe('Branch not found');
    });

    it('400 for a custom role that belongs to another organization', async () => {
      const betaRole = await fx.prisma.role.create({
        data: { key: 'intern', name: 'Стажёр', level: 5, organizationId: await fx.orgId('beta') },
      });
      await timur
        .post(`${alpha}/users`, { email: 'x@example.com', name: 'X', roleId: betaRole.id })
        .expect(400);
    });

    it('accepts a custom role of the same organization', async () => {
      const alphaRole = await fx.prisma.role.create({
        data: { key: 'intern', name: 'Стажёр', level: 5, organizationId: await fx.orgId('alpha') },
      });
      const res = await timur
        .post(`${alpha}/users`, { email: 'x@example.com', name: 'X', roleId: alphaRole.id })
        .expect(201);
      expect(res.body.role.key).toBe('intern');
    });

    it('a manager can add employees but not managers or admins (no privilege escalation)', async () => {
      await timur
        .post(`${beta}/users`, { email: 'e@example.com', name: 'E', roleId: roles.employee })
        .expect(201);
      for (const roleId of [roles.manager, roles.admin]) {
        const res = await timur
          .post(`${beta}/users`, { email: 'm@example.com', name: 'M', roleId })
          .expect(403);
        expect(res.body.code).toBe('ROLE_TOO_HIGH');
      }
    });

    it('rejects unknown fields and malformed input', async () => {
      await timur
        .post(`${alpha}/users`, { email: 'not-an-email', name: 'X', roleId: roles.employee })
        .expect(400);
      await timur
        .post(`${alpha}/users`, { email: 'x@example.com', name: 'X', roleId: 'nope' })
        .expect(400);
      await timur
        .post(`${alpha}/users`, {
          email: 'x@example.com',
          name: 'X',
          roleId: roles.employee,
          organizationId: 'hack',
        })
        .expect(400);
    });

    it('concurrent adds of the same person: exactly one succeeds, the other gets 409', async () => {
      const body = { email: 'race@example.com', name: 'Гонка', roleId: roles.employee };
      const results = await Promise.all([
        timur.post(`${alpha}/users`, body),
        timur.post(`${alpha}/users`, body),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(await fx.prisma.user.count({ where: { email: 'race@example.com' } })).toBe(1);
    });

    it('concurrent restores of a removed member: exactly one succeeds, the other gets 409', async () => {
      const tamerlanId = await fx.userId('tamerlan@example.com');
      await timur.delete(`${alpha}/users/${tamerlanId}`).expect(204);

      const body = { email: 'tamerlan@example.com', roleId: roles.employee };
      const results = await Promise.all([
        timur.post(`${alpha}/users`, body),
        timur.post(`${alpha}/users`, body),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    });

    it('the same new email added to two organizations at once: both succeed, one account', async () => {
      const email = 'shared-race@example.com';
      const results = await Promise.all([
        timur.post(`${alpha}/users`, { email, name: 'Гонка', roleId: roles.employee }),
        timur.post(`${beta}/users`, { email, name: 'Гонка', roleId: roles.employee }),
      ]);
      expect(results.map((r) => r.status)).toEqual([201, 201]);
      expect(await fx.prisma.user.count({ where: { email } })).toBe(1);
      expect(await membershipsOf(email)).toHaveLength(2);
    });
  });

  describe('PATCH /users/:userId — change role / branch', () => {
    it('changes role and branch', async () => {
      const target = await fx.memberId('alpha', 'employee');
      const [, branchId] = await fx.branchIds('alpha');
      const before = await timur.get(`${alpha}/users/${target}`).expect(200);
      const res = await timur
        .patch(`${alpha}/users/${target}`, { roleId: roles.manager, branchId })
        .expect(200);
      expect(res.body).toMatchObject({ role: { key: 'manager' }, branch: { id: branchId } });
      expect(new Date(res.body.updatedAt) > new Date(before.body.updatedAt)).toBe(true);
    });

    it('branchId: null removes the branch, omitted leaves it unchanged', async () => {
      const target = await fx.memberId('alpha', 'employee');
      const [branchId] = await fx.branchIds('alpha');
      await timur.patch(`${alpha}/users/${target}`, { branchId }).expect(200);

      const roleOnly = await timur
        .patch(`${alpha}/users/${target}`, { roleId: roles.manager })
        .expect(200);
      expect(roleOnly.body.branch.id).toBe(branchId);

      const cleared = await timur.patch(`${alpha}/users/${target}`, { branchId: null }).expect(200);
      expect(cleared.body.branch).toBeNull();
    });

    it('400 when there is nothing to update', async () => {
      await timur.patch(`${alpha}/users/${await fx.memberId('alpha', 'employee')}`, {}).expect(400);
    });

    it('400 for roleId: null (a member always has a role)', async () => {
      const target = await fx.memberId('alpha', 'employee');
      const res = await timur.patch(`${alpha}/users/${target}`, { roleId: null }).expect(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('400 for a branch of another organization', async () => {
      const [betaBranch] = await fx.branchIds('beta');
      await timur
        .patch(`${alpha}/users/${await fx.memberId('alpha', 'employee')}`, { branchId: betaBranch })
        .expect(400);
    });

    it('404 for a user of another organization, even with a valid id (IDOR)', async () => {
      const betaOnlyMember = await fx.userId('aiganym@example.com');
      const res = await timur
        .patch(`${alpha}/users/${betaOnlyMember}`, { roleId: roles.employee })
        .expect(404);
      expect(res.body.code).toBe('NOT_FOUND');
      // Nothing changed in Бета
      const [membership] = await membershipsOf('aiganym@example.com');
      expect(membership.roleId).toBe(roles.admin);
    });

    it('a manager cannot edit another manager or an admin', async () => {
      const otherManager = await fx.memberId('beta', 'manager');
      const res = await timur
        .patch(`${beta}/users/${otherManager}`, { branchId: null })
        .expect(403);
      expect(res.body.code).toBe('ROLE_TOO_HIGH');
      await timur
        .patch(`${beta}/users/${await fx.userId('aiganym@example.com')}`, { branchId: null })
        .expect(403);
    });

    it('a manager cannot promote an employee to manager', async () => {
      const employee = await fx.memberId('beta', 'employee');
      const res = await timur
        .patch(`${beta}/users/${employee}`, { roleId: roles.manager })
        .expect(403);
      expect(res.body.code).toBe('ROLE_TOO_HIGH');
    });

    it('a manager cannot change their own role', async () => {
      await timur
        .patch(`${beta}/users/${await fx.userId('timur@example.com')}`, { roleId: roles.employee })
        .expect(403);
    });

    it('409 LAST_ADMIN when the only admin tries to demote themselves', async () => {
      const res = await timur
        .patch(`${alpha}/users/${await fx.userId('timur@example.com')}`, { roleId: roles.employee })
        .expect(409);
      expect(res.body.code).toBe('LAST_ADMIN');
    });

    it('a custom role keyed "admin" does not count as an administrator', async () => {
      const lookalike = await fx.prisma.role.create({
        data: {
          key: 'admin',
          name: 'Почти админ',
          level: 90,
          organizationId: await fx.orgId('alpha'),
        },
      });
      const res = await timur
        .patch(`${alpha}/users/${await fx.userId('timur@example.com')}`, { roleId: lookalike.id })
        .expect(409);
      expect(res.body.code).toBe('LAST_ADMIN');
    });

    it('an admin can step down once there is another admin', async () => {
      const timurId = await fx.userId('timur@example.com');
      await timur
        .patch(`${alpha}/users/${await fx.memberId('alpha', 'employee')}`, { roleId: roles.admin })
        .expect(200);
      const res = await timur
        .patch(`${alpha}/users/${timurId}`, { roleId: roles.employee })
        .expect(200);
      expect(res.body.role.key).toBe('employee');
    });

    it('an invited admin does not count as the remaining admin', async () => {
      const created = await timur
        .post(`${alpha}/users`, {
          email: 'invited.admin@example.com',
          name: 'Приглашённый',
          roleId: roles.admin,
        })
        .expect(201);
      expect(created.body.status).toBe('invited');
      await timur
        .patch(`${alpha}/users/${await fx.userId('timur@example.com')}`, { roleId: roles.employee })
        .expect(409);
    });

    it('two admins demoting each other at the same time: exactly one succeeds', async () => {
      const otherAdminId = await fx.memberId('alpha', 'employee');
      await timur.patch(`${alpha}/users/${otherAdminId}`, { roleId: roles.admin }).expect(200);
      const { email } = await fx.prisma.user.findUniqueOrThrow({ where: { id: otherAdminId } });
      const other = as(app, await login(app, email));
      const timurId = await fx.userId('timur@example.com');

      // Without the row lock in ensureNotLastAdmin both requests succeed and the org has no admin

      const results = await Promise.all([
        timur.patch(`${alpha}/users/${otherAdminId}`, { roleId: roles.employee }),
        other.patch(`${alpha}/users/${timurId}`, { roleId: roles.employee }),
      ]);

      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
      const admins = await fx.prisma.membership.count({
        where: { organization: { name: 'Альфа Логистик' }, roleId: roles.admin, deletedAt: null },
      });
      expect(admins).toBe(1);
    });
  });

  describe('DELETE /users/:userId — remove from organization', () => {
    it('removes the membership only: the account and other memberships stay', async () => {
      const aiganym = as(app, await login(app, 'aiganym@example.com'));
      const timurId = await fx.userId('timur@example.com');
      await aiganym.delete(`${beta}/users/${timurId}`).expect(204);

      await aiganym.get(`${beta}/users/${timurId}`).expect(404);
      expect(await fx.prisma.user.findUnique({ where: { id: timurId } })).not.toBeNull();
      const active = (await membershipsOf('timur@example.com')).filter((m) => !m.deletedAt);
      expect(active.map((m) => m.organization.name).sort()).toEqual([
        'Альфа Логистик',
        'Гамма Строй',
        'Дельта Консалтинг',
      ]);
    });

    it('removed members disappear from the list and the total', async () => {
      const before = (await timur.get(`${alpha}/users`).expect(200)).body.total;
      await timur.delete(`${alpha}/users/${await fx.memberId('alpha', 'employee')}`).expect(204);
      expect((await timur.get(`${alpha}/users`).expect(200)).body.total).toBe(before - 1);
    });

    it('deleting twice returns 404 the second time', async () => {
      const target = await fx.memberId('alpha', 'employee');
      await timur.delete(`${alpha}/users/${target}`).expect(204);
      await timur.delete(`${alpha}/users/${target}`).expect(404);
    });

    it('409 LAST_ADMIN when the only admin tries to leave', async () => {
      const res = await timur
        .delete(`${alpha}/users/${await fx.userId('timur@example.com')}`)
        .expect(409);
      expect(res.body.code).toBe('LAST_ADMIN');
    });

    it('404 for a member of another organization (IDOR)', async () => {
      await timur.delete(`${alpha}/users/${await fx.userId('aiganym@example.com')}`).expect(404);
      expect((await membershipsOf('aiganym@example.com'))[0].deletedAt).toBeNull();
    });

    it('a manager has no delete permission at all', async () => {
      const res = await timur
        .delete(`${beta}/users/${await fx.memberId('beta', 'employee')}`)
        .expect(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });
  });
});
