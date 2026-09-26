import type { ModuleKey, PermissionKey } from './access.constants.js';

/** The caller's membership in the organization from the URL, resolved by OrganizationAccessGuard */
export interface OrgContext {
  organizationId: string;
  userId: string;
  membershipId: string;
  role: { id: string; key: string; level: number };
  permissions: ReadonlySet<PermissionKey>;
  modules: ReadonlySet<ModuleKey>;
}
