import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import type { ModuleKey, PermissionKey } from './access.constants.js';
import type { OrgContext } from './access.types.js';

export const PERMISSIONS_KEY = 'requiredPermissions';
export const MODULE_KEY = 'requiredModule';

/** All listed permissions are required in the organization from the URL */
export const RequirePermissions = (...permissions: PermissionKey[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/** The organization must have this business module enabled */
export const RequireModule = (module: ModuleKey) => SetMetadata(MODULE_KEY, module);

export const CurrentOrg = createParamDecorator((_: unknown, ctx: ExecutionContext): OrgContext => {
  const orgContext = ctx
    .switchToHttp()
    .getRequest<Request & { orgContext?: OrgContext }>().orgContext;
  if (!orgContext) {
    throw new Error('@CurrentOrg() used on a route without :organizationId');
  }
  return orgContext;
});
