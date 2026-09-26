/**
 * Demo data, shared by the CLI seed (prisma/seed.ts) and e2e tests.
 *
 * Demo accounts (password: "password"):
 *   ivan@example.com   — Альфа: admin, Бета: manager, Гамма: employee, Дельта: admin (module "users" off)
 *   maria@example.com  — Бета: admin
 *   oleg@example.com   — Гамма: admin
 *   elena@example.com  — Альфа: employee
 */
import bcrypt from 'bcryptjs';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import {
  Module,
  PERMISSION_DESCRIPTIONS,
  SYSTEM_ROLES,
  SystemRole,
  type ModuleKey,
  type PermissionKey,
  type SystemRoleKey,
} from '../src/access/access.constants.js';

export const DEMO_PASSWORD = 'password';

// Deterministic PRNG so every seed produces the same data
let rngState = 42;
function rand() {
  rngState = (rngState * 1103515245 + 12345) % 2 ** 31;
  return rngState / 2 ** 31;
}
const pick = <T>(items: readonly T[]) => items[Math.floor(rand() * items.length)];

const FIRST_NAMES = [
  ['Алексей', 'aleksey'],
  ['Дмитрий', 'dmitry'],
  ['Сергей', 'sergey'],
  ['Андрей', 'andrey'],
  ['Михаил', 'mikhail'],
  ['Никита', 'nikita'],
  ['Артём', 'artem'],
  ['Павел', 'pavel'],
  ['Анна', 'anna'],
  ['Ольга', 'olga'],
  ['Татьяна', 'tatiana'],
  ['Наталья', 'natalia'],
  ['Екатерина', 'ekaterina'],
  ['Юлия', 'yulia'],
  ['Ирина', 'irina'],
  ['Светлана', 'svetlana'],
  ['Айгерим', 'aigerim'],
  ['Дамир', 'damir'],
  ['Тимур', 'timur'],
  ['Динара', 'dinara'],
] as const;
const LAST_NAMES = [
  ['Смирнов', 'smirnov'],
  ['Кузнецов', 'kuznetsov'],
  ['Попов', 'popov'],
  ['Васильев', 'vasiliev'],
  ['Соколов', 'sokolov'],
  ['Морозов', 'morozov'],
  ['Волков', 'volkov'],
  ['Лебедев', 'lebedev'],
  ['Козлов', 'kozlov'],
  ['Новиков', 'novikov'],
  ['Ахметов', 'akhmetov'],
  ['Сулейменов', 'suleimenov'],
] as const;
const FEMALE = new Set([
  'anna',
  'olga',
  'tatiana',
  'natalia',
  'ekaterina',
  'yulia',
  'irina',
  'svetlana',
  'aigerim',
  'dinara',
]);

const ORGANIZATIONS = [
  {
    key: 'alpha',
    name: 'Альфа Логистик',
    branches: ['Алматы', 'Астана', 'Шымкент'],
    modules: [Module.Users, Module.Crm, Module.Warehouse],
  },
  {
    key: 'beta',
    name: 'Бета Ритейл',
    branches: ['Центральный', 'Северный'],
    modules: [Module.Users, Module.Sales, Module.Reports],
  },
  {
    key: 'gamma',
    name: 'Гамма Строй',
    branches: ['Главный офис', 'Объект №1', 'Объект №2'],
    modules: [Module.Users, Module.Tasks],
  },
  // "users" module intentionally not enabled: demonstrates the module check
  { key: 'delta', name: 'Дельта Консалтинг', branches: ['Офис'], modules: [Module.Crm] },
] as const satisfies ReadonlyArray<{
  key: string;
  name: string;
  branches: readonly string[];
  modules: readonly ModuleKey[];
}>;
type OrgKey = (typeof ORGANIZATIONS)[number]['key'];

const DEMO_USERS: Array<{
  email: string;
  name: string;
  memberships: Partial<Record<OrgKey, SystemRoleKey>>;
}> = [
  {
    email: 'ivan@example.com',
    name: 'Иван Петров',
    memberships: {
      alpha: SystemRole.Admin,
      beta: SystemRole.Manager,
      gamma: SystemRole.Employee,
      delta: SystemRole.Admin,
    },
  },
  { email: 'maria@example.com', name: 'Мария Иванова', memberships: { beta: SystemRole.Admin } },
  { email: 'oleg@example.com', name: 'Олег Сидоров', memberships: { gamma: SystemRole.Admin } },
  { email: 'elena@example.com', name: 'Елена Орлова', memberships: { alpha: SystemRole.Employee } },
];

const GENERATED_USERS_PER_ORG = 25;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Returns false if the database was already seeded */
export async function seed(prisma: PrismaClient): Promise<boolean> {
  rngState = 42;
  if ((await prisma.permission.count()) > 0) {
    return false;
  }

  await prisma.$transaction(
    async (tx) => {
      // Permissions and system roles
      const permissionIds = new Map<PermissionKey, string>();
      for (const [key, description] of Object.entries(PERMISSION_DESCRIPTIONS)) {
        const p = await tx.permission.create({ data: { key, description } });
        permissionIds.set(key as PermissionKey, p.id);
      }

      const roleIds = new Map<SystemRoleKey, string>();
      for (const [key, role] of Object.entries(SYSTEM_ROLES)) {
        const r = await tx.role.create({
          data: {
            key,
            name: role.name,
            level: role.level,
            permissions: {
              create: role.permissions.map((p) => ({ permissionId: permissionIds.get(p)! })),
            },
          },
        });
        roleIds.set(key as SystemRoleKey, r.id);
      }

      // Organizations, branches, modules
      const orgs = new Map<OrgKey, { id: string; branchIds: string[] }>();
      for (const org of ORGANIZATIONS) {
        const created = await tx.organization.create({
          data: {
            name: org.name,
            branches: { create: org.branches.map((name) => ({ name })) },
            modules: { create: org.modules.map((moduleKey) => ({ moduleKey })) },
          },
          include: { branches: true },
        });
        orgs.set(org.key, { id: created.id, branchIds: created.branches.map((b) => b.id) });
      }

      const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
      const now = Date.now();

      // Demo accounts
      for (const demo of DEMO_USERS) {
        await tx.user.create({
          data: {
            email: demo.email,
            name: demo.name,
            passwordHash,
            memberships: {
              create: Object.entries(demo.memberships).map(([orgKey, roleKey]) => {
                const org = orgs.get(orgKey as OrgKey)!;
                return {
                  organizationId: org.id,
                  roleId: roleIds.get(roleKey)!,
                  branchId: org.branchIds[0],
                  createdAt: new Date(now - 200 * DAY_MS),
                };
              }),
            },
          },
        });
      }

      // Generated members. A shared pool, so some people belong to several organizations.
      const pool: Array<{ email: string; name: string }> = [];
      const usedEmails = new Set(DEMO_USERS.map((u) => u.email));
      while (pool.length < 70) {
        const [firstRu, firstEn] = pick(FIRST_NAMES);
        const [lastRu, lastEn] = pick(LAST_NAMES);
        const female = FEMALE.has(firstEn);
        const email = `${firstEn}.${lastEn}${female ? 'a' : ''}@example.com`;
        if (usedEmails.has(email)) continue;
        usedEmails.add(email);
        pool.push({ email, name: `${firstRu} ${lastRu}${female ? 'а' : ''}` });
      }

      const poolUsers = new Map<string, { id: string; invited: boolean }>();
      for (const [index, org] of ORGANIZATIONS.entries()) {
        if (org.key === 'delta') continue;
        const { id: organizationId, branchIds } = orgs.get(org.key)!;
        // Overlapping windows over the pool: neighbouring organizations share ~5 people
        const members = pool.slice(index * 20, index * 20 + GENERATED_USERS_PER_ORG);

        for (const [i, person] of members.entries()) {
          let user = poolUsers.get(person.email);
          if (!user) {
            // Invited = account created by an admin, the person hasn't set a password yet
            const invited = rand() < 0.15;
            const created = await tx.user.create({
              data: { ...person, passwordHash: invited ? null : passwordHash },
            });
            user = { id: created.id, invited };
            poolUsers.set(person.email, user);
          }

          await tx.membership.create({
            data: {
              userId: user.id,
              organizationId,
              // A couple of managers per organization, the rest are employees
              roleId: roleIds.get(i < 3 ? SystemRole.Manager : SystemRole.Employee)!,
              branchId: rand() < 0.15 ? null : pick(branchIds),
              status: user.invited ? 'INVITED' : 'ACTIVE',
              createdAt: new Date(now - Math.floor(rand() * 180) * DAY_MS),
            },
          });
        }
      }
    },
    { timeout: 60_000 },
  );

  return true;
}
