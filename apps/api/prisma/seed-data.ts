/**
 * Demo data, shared by the CLI seed (prisma/seed.ts) and e2e tests.
 *
 * Demo accounts (password: "password"):
 *   timur@example.com     — Альфа: admin, Бета: manager, Гамма: employee, Дельта: admin (module "users" off)
 *   aiganym@example.com   — Бета: admin
 *   rustem@example.com    — Гамма: admin
 *   tamerlan@example.com  — Альфа: employee
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
  ['Нурлан', 'nurlan'],
  ['Ержан', 'yerzhan'],
  ['Данияр', 'daniyar'],
  ['Асхат', 'askhat'],
  ['Арман', 'arman'],
  ['Бауыржан', 'baurzhan'],
  ['Дамир', 'damir'],
  ['Ерлан', 'yerlan'],
  ['Азамат', 'azamat'],
  ['Мирас', 'miras'],
  ['Айгерим', 'aigerim'],
  ['Динара', 'dinara'],
  ['Жанар', 'zhanar'],
  ['Асель', 'asel'],
  ['Гульнара', 'gulnara'],
  ['Камила', 'kamila'],
  ['Мадина', 'madina'],
  ['Сауле', 'saule'],
  ['Алия', 'aliya'],
  ['Жулдыз', 'zhuldyz'],
] as const;
const LAST_NAMES = [
  ['Ахметов', 'akhmetov'],
  ['Сулейменов', 'suleimenov'],
  ['Касымов', 'kasymov'],
  ['Нургалиев', 'nurgaliev'],
  ['Абдрахманов', 'abdrakhmanov'],
  ['Искаков', 'iskakov'],
  ['Омаров', 'omarov'],
  ['Жаксылыков', 'zhaksylykov'],
  ['Байжанов', 'baizhanov'],
  ['Токтаров', 'toktarov'],
  ['Есенов', 'yesenov'],
  ['Кенжебеков', 'kenzhebekov'],
] as const;
const FEMALE = new Set([
  'aigerim',
  'dinara',
  'zhanar',
  'asel',
  'gulnara',
  'kamila',
  'madina',
  'saule',
  'aliya',
  'zhuldyz',
]);

const ORGANIZATIONS = [
  {
    key: 'alpha',
    name: 'Альфа Логистик',
    description: 'Грузоперевозки и складская логистика по Казахстану',
    branches: [
      { name: 'Алматы', address: 'г. Алматы, пр. Абая, 150' },
      { name: 'Астана', address: 'г. Астана, ул. Кенесары, 40' },
      { name: 'Шымкент', address: 'г. Шымкент, пр. Тауке хана, 12' },
    ],
    modules: [Module.Users, Module.Crm, Module.Warehouse],
  },
  {
    key: 'beta',
    name: 'Бета Ритейл',
    description: 'Сеть магазинов бытовой техники в Алматы',
    branches: [
      { name: 'Центральный', address: 'г. Алматы, ул. Толе би, 101' },
      { name: 'Северный', address: 'г. Алматы, мкр. Жетысу-2, 7' },
    ],
    modules: [Module.Users, Module.Sales, Module.Reports],
  },
  {
    key: 'gamma',
    name: 'Гамма Строй',
    description: 'Строительство жилых комплексов в Астане и пригороде',
    branches: [
      { name: 'Главный офис', address: 'г. Астана, пр. Мангилик Ел, 55' },
      { name: 'Объект №1', address: 'г. Астана, ул. Сыганак, 18' },
      { name: 'Объект №2', address: 'г. Косшы, ул. Республики, 3' },
    ],
    modules: [Module.Users, Module.Tasks],
  },
  // "users" module intentionally not enabled: demonstrates the module check
  {
    key: 'delta',
    name: 'Дельта Консалтинг',
    description: 'Бухгалтерский и налоговый консалтинг',
    branches: [{ name: 'Офис', address: 'г. Караганда, ул. Бухар-Жырау, 64' }],
    modules: [Module.Crm],
  },
] as const satisfies ReadonlyArray<{
  key: string;
  name: string;
  description: string;
  branches: ReadonlyArray<{ name: string; address: string }>;
  modules: readonly ModuleKey[];
}>;
type OrgKey = (typeof ORGANIZATIONS)[number]['key'];

const DEMO_USERS: Array<{
  email: string;
  name: string;
  memberships: Partial<Record<OrgKey, SystemRoleKey>>;
}> = [
  {
    email: 'timur@example.com',
    name: 'Тимур Бекенов',
    memberships: {
      alpha: SystemRole.Admin,
      beta: SystemRole.Manager,
      gamma: SystemRole.Employee,
      delta: SystemRole.Admin,
    },
  },
  {
    email: 'aiganym@example.com',
    name: 'Айганым Нурланова',
    memberships: { beta: SystemRole.Admin },
  },
  {
    email: 'rustem@example.com',
    name: 'Рустем Жумабаев',
    memberships: { gamma: SystemRole.Admin },
  },
  {
    email: 'tamerlan@example.com',
    name: 'Тамерлан Сарсенов',
    memberships: { alpha: SystemRole.Employee },
  },
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
            description: org.description,
            branches: { create: org.branches.map((b) => ({ name: b.name, address: b.address })) },
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
