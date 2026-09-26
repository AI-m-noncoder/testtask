import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { AuthUser } from '../auth/auth.types.js';
import { AppException } from '../common/errors/app.exception.js';
import { ErrorCode } from '../common/errors/error-codes.js';
import { isUuid } from '../common/uuid.js';
import type { ModuleKey, PermissionKey } from './access.constants.js';
import { AccessService } from './access.service.js';
import type { OrgContext } from './access.types.js';
import { MODULE_KEY, PERMISSIONS_KEY } from './decorators.js';

type OrgRequest = Request & { user?: AuthUser; orgContext?: OrgContext };

/**
 * Global guard, runs after JwtAuthGuard. Activates on every route with an
 * `:organizationId` param, so a new org-scoped endpoint can't be left unprotected.
 *
 * Not a member (or unknown org) → 404, so the existence of other tenants isn't revealed.
 * Member without the module / permission → 403.
 */
@Injectable()
export class OrganizationAccessGuard implements CanActivate {
  constructor(
    private readonly access: AccessService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    const permissions = this.reflector.getAllAndMerge<PermissionKey[]>(PERMISSIONS_KEY, targets);
    const module = this.reflector.getAllAndOverride<ModuleKey | undefined>(MODULE_KEY, targets);

    const req = context.switchToHttp().getRequest<OrgRequest>();
    const organizationId = req.params.organizationId;

    if (organizationId === undefined) {
      if (permissions.length > 0 || module) {
        // Programming error: permission metadata is meaningless without an organization
        throw new Error(`Access metadata on a route without :organizationId (${req.path})`);
      }
      return true;
    }

    if (!req.user) throw AppException.unauthorized();
    if (typeof organizationId !== 'string' || !isUuid(organizationId)) {
      throw AppException.notFound('Organization not found');
    }

    const orgContext = await this.access.resolveOrgContext(req.user.userId, organizationId);
    if (!orgContext) throw AppException.notFound('Organization not found');

    if (module && !orgContext.modules.has(module)) {
      throw AppException.forbidden(
        `Module "${module}" is not enabled for this organization`,
        ErrorCode.ModuleDisabled,
      );
    }

    const missing = permissions.filter((p) => !orgContext.permissions.has(p));
    if (missing.length > 0) throw AppException.forbidden();

    req.orgContext = orgContext;
    return true;
  }
}
