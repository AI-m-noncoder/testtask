import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ModuleKey, PermissionKey } from './access.constants.js';
import type { OrgContext } from './access.types.js';

@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the user's active membership in the organization, or null if they
   * aren't a member (or were removed). One query: role, permissions and modules.
   */
  async resolveOrgContext(userId: string, organizationId: string): Promise<OrgContext | null> {
    const membership = await this.prisma.membership.findFirst({
      where: { userId, organizationId, deletedAt: null, status: 'ACTIVE' },
      select: {
        id: true,
        role: {
          select: {
            id: true,
            key: true,
            level: true,
            permissions: { select: { permission: { select: { key: true } } } },
          },
        },
        organization: {
          select: { modules: { where: { enabled: true }, select: { moduleKey: true } } },
        },
      },
    });
    if (!membership) return null;

    const { role, organization } = membership;
    return {
      organizationId,
      userId,
      membershipId: membership.id,
      role: { id: role.id, key: role.key, level: role.level },
      permissions: new Set(role.permissions.map((p) => p.permission.key as PermissionKey)),
      modules: new Set(organization.modules.map((m) => m.moduleKey as ModuleKey)),
    };
  }
}
