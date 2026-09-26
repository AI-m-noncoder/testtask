import { Injectable } from '@nestjs/common';
import { AppException } from '../common/errors/app.exception.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class MeService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });
    // Token outlived the account
    if (!user) throw AppException.unauthorized();
    return user;
  }

  /** Organizations the user can switch to, with what they're allowed to do in each */
  async getOrganizations(userId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: { userId, deletedAt: null, status: 'ACTIVE' },
      orderBy: { organization: { name: 'asc' } },
      select: {
        organization: {
          select: {
            id: true,
            name: true,
            modules: { where: { enabled: true }, select: { moduleKey: true } },
          },
        },
        role: {
          select: {
            id: true,
            key: true,
            name: true,
            level: true,
            permissions: { select: { permission: { select: { key: true } } } },
          },
        },
      },
    });

    return memberships.map(({ organization, role }) => ({
      id: organization.id,
      name: organization.name,
      role: { id: role.id, key: role.key, name: role.name, level: role.level },
      permissions: role.permissions.map((p) => p.permission.key).sort(),
      modules: organization.modules.map((m) => m.moduleKey).sort(),
    }));
  }
}
