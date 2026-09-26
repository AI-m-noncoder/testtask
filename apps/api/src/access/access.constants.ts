/**
 * Single source of truth for permission, role and module keys.
 * Used by guards/services and by the database seed.
 */

export const Permission = {
  UsersRead: 'users.read',
  UsersCreate: 'users.create',
  UsersUpdate: 'users.update',
  UsersDelete: 'users.delete',
} as const;
export type PermissionKey = (typeof Permission)[keyof typeof Permission];

export const PERMISSION_DESCRIPTIONS: Record<PermissionKey, string> = {
  [Permission.UsersRead]: 'View organization members',
  [Permission.UsersCreate]: 'Add members to the organization',
  [Permission.UsersUpdate]: 'Change member role and branch',
  [Permission.UsersDelete]: 'Remove members from the organization',
};

export const SystemRole = {
  Admin: 'admin',
  Manager: 'manager',
  Employee: 'employee',
} as const;
export type SystemRoleKey = (typeof SystemRole)[keyof typeof SystemRole];

export const SYSTEM_ROLES: Record<
  SystemRoleKey,
  { name: string; level: number; permissions: PermissionKey[] }
> = {
  [SystemRole.Admin]: {
    name: 'Администратор',
    level: 100,
    permissions: Object.values(Permission),
  },
  [SystemRole.Manager]: {
    name: 'Менеджер',
    level: 50,
    permissions: [Permission.UsersRead, Permission.UsersCreate, Permission.UsersUpdate],
  },
  [SystemRole.Employee]: {
    name: 'Сотрудник',
    level: 10,
    permissions: [],
  },
};

export const Module = {
  Users: 'users',
  Crm: 'crm',
  Sales: 'sales',
  Warehouse: 'warehouse',
  Tasks: 'tasks',
  Reports: 'reports',
} as const;
export type ModuleKey = (typeof Module)[keyof typeof Module];
