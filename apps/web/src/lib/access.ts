import type { MyOrganization } from '../api/types';

export const Permission = {
  UsersRead: 'users.read',
  UsersCreate: 'users.create',
  UsersUpdate: 'users.update',
  UsersDelete: 'users.delete',
} as const;

const TOP_LEVEL = 100;

/**
 * Mirrors apps/api/src/access/role-hierarchy.ts. Used only to hide actions the API
 * would reject; the API remains the source of truth.
 */
export const canManageLevel = (actorLevel: number, targetLevel: number) =>
  targetLevel < actorLevel || actorLevel >= TOP_LEVEL;

export const can = (org: MyOrganization | undefined, permission: string) =>
  org?.permissions.includes(permission) ?? false;
