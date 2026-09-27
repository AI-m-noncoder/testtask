import { Injectable } from '@nestjs/common';
import { SystemRole } from '../access/access.constants.js';
import type { OrgContext } from '../access/access.types.js';
import { canManageLevel } from '../access/role-hierarchy.js';
import { AppException } from '../common/errors/app.exception.js';
import { ErrorCode } from '../common/errors/error-codes.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateMemberDto } from './dto/create-member.dto.js';
import {
  type ListMembersQueryDto,
  type MemberSortField,
  NO_BRANCH,
} from './dto/list-members.query.js';
import type { UpdateMemberDto } from './dto/update-member.dto.js';
import { type Member, memberSelect, toMember } from './member.mapper.js';

type Tx = Prisma.TransactionClient;
type SortOrder = Prisma.SortOrder;

const ORDER_BY: Record<
  MemberSortField,
  (o: SortOrder) => Prisma.MembershipOrderByWithRelationInput
> = {
  name: (o) => ({ user: { name: o } }),
  email: (o) => ({ user: { email: o } }),
  createdAt: (o) => ({ createdAt: o }),
  role: (o) => ({ role: { level: o } }),
};

/** Escapes LIKE wildcards so a search for "_" or "%" matches literally */
const escapeLike = (value: string) => value.replace(/[\\%_]/g, '\\$&');

/** The "last admin" invariant is about the system admin role, not a custom role that reuses its key */
const isSystemAdmin = (role: { key: string; organizationId: string | null }) =>
  role.key === SystemRole.Admin && role.organizationId === null;

const alreadyMember = () =>
  AppException.conflict(ErrorCode.AlreadyMember, 'User is already a member of this organization');

@Injectable()
export class OrganizationUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string, query: ListMembersQueryDto) {
    const { page, pageSize, search, roleId, branchId, status, sortBy, sortOrder } = query;
    const pattern = search ? escapeLike(search) : undefined;

    const where: Prisma.MembershipWhereInput = {
      organizationId,
      deletedAt: null,
      ...(roleId && { roleId }),
      ...(branchId && { branchId: branchId === NO_BRANCH ? null : branchId }),
      ...(status && { status: status === 'active' ? 'ACTIVE' : 'INVITED' }),
      ...(pattern && {
        user: {
          OR: [
            { name: { contains: pattern, mode: 'insensitive' } },
            { email: { contains: pattern, mode: 'insensitive' } },
          ],
        },
      }),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.membership.count({ where }),
      this.prisma.membership.findMany({
        where,
        select: memberSelect,
        // id as tiebreaker keeps pagination stable when sort values are equal
        orderBy: [ORDER_BY[sortBy](sortOrder), { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return { items: rows.map(toMember), total, page, pageSize };
  }

  async get(organizationId: string, userId: string): Promise<Member> {
    const row = await this.prisma.membership.findFirst({
      where: { organizationId, userId, deletedAt: null },
      select: memberSelect,
    });
    if (!row) throw AppException.notFound('Member not found');
    return toMember(row);
  }

  /**
   * Adds a person by email. An existing account is linked (one account across
   * organizations); otherwise an invited account is created. A previously removed
   * member is restored.
   */
  async create(ctx: OrgContext, dto: CreateMemberDto): Promise<Member> {
    const { organizationId } = ctx;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const role = await this.findAssignableRole(tx, ctx, dto.roleId);
        if (dto.branchId) await this.ensureBranch(tx, organizationId, dto.branchId);

        let user = await tx.user.findUnique({ where: { email: dto.email } });
        if (!user) {
          if (!dto.name) {
            throw AppException.badRequest('Name is required for a person without an account', [
              'name should not be empty',
            ]);
          }
          // ON CONFLICT DO NOTHING: another organization may be inviting the same email
          // right now; then both link to the one account instead of one request failing
          await tx.user.createMany({
            data: { email: dto.email, name: dto.name },
            skipDuplicates: true,
          });
          user = await tx.user.findUniqueOrThrow({ where: { email: dto.email } });
        }
        // An existing account's name is not overwritten: it's shared with other organizations

        const existing = await tx.membership.findUnique({
          where: { userId_organizationId: { userId: user.id, organizationId } },
          select: { id: true, deletedAt: true },
        });
        if (existing && !existing.deletedAt) throw alreadyMember();

        const data = {
          roleId: role.id,
          branchId: dto.branchId ?? null,
          status: user.passwordHash ? ('ACTIVE' as const) : ('INVITED' as const),
        };
        if (!existing) {
          const row = await tx.membership.create({
            data: { ...data, userId: user.id, organizationId },
            select: memberSelect,
          });
          return toMember(row);
        }

        // Restore. The deletedAt condition makes a concurrent restore of the same member
        // wait for this row lock and then match nothing, instead of both succeeding
        const { count } = await tx.membership.updateMany({
          where: { id: existing.id, deletedAt: { not: null } },
          data: { ...data, deletedAt: null, createdAt: new Date() },
        });
        if (count === 0) throw alreadyMember();
        const row = await tx.membership.findUniqueOrThrow({
          where: { id: existing.id },
          select: memberSelect,
        });
        return toMember(row);
      });
    } catch (error) {
      // Concurrent request added the same person first (unique user_id + organization_id)
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw alreadyMember();
      }
      throw error;
    }
  }

  async update(ctx: OrgContext, userId: string, dto: UpdateMemberDto): Promise<Member> {
    if (dto.roleId === undefined && dto.branchId === undefined) {
      throw AppException.badRequest('Nothing to update: provide roleId and/or branchId');
    }

    return this.prisma.$transaction(async (tx) => {
      const target = await this.findManageableTarget(tx, ctx, userId);

      if (dto.roleId !== undefined && dto.roleId !== target.roleId) {
        const role = await this.findAssignableRole(tx, ctx, dto.roleId);
        if (isSystemAdmin(target.role) && !isSystemAdmin(role)) {
          await this.ensureNotLastAdmin(tx, ctx.organizationId, target.id);
        }
      }
      if (dto.branchId) await this.ensureBranch(tx, ctx.organizationId, dto.branchId);

      await this.writeIfUnchanged(tx, target, {
        ...(dto.roleId !== undefined && { roleId: dto.roleId }),
        ...(dto.branchId !== undefined && { branchId: dto.branchId }),
      });
      const row = await tx.membership.findUniqueOrThrow({
        where: { id: target.id },
        select: memberSelect,
      });
      return toMember(row);
    });
  }

  /** Removes the membership only; the account and other memberships are untouched */
  async remove(ctx: OrgContext, userId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const target = await this.findManageableTarget(tx, ctx, userId);
      if (isSystemAdmin(target.role)) {
        await this.ensureNotLastAdmin(tx, ctx.organizationId, target.id);
      }
      await this.writeIfUnchanged(tx, target, { deletedAt: new Date() });
    });
  }

  async listRoles(ctx: OrgContext) {
    const roles = await this.prisma.role.findMany({
      where: { OR: [{ organizationId: null }, { organizationId: ctx.organizationId }] },
      select: { id: true, key: true, name: true, level: true },
      orderBy: [{ level: 'desc' }, { name: 'asc' }],
    });
    // Lets the UI offer only roles the caller is allowed to assign
    return roles.map((role) => ({
      ...role,
      assignable: canManageLevel(ctx.role.level, role.level),
    }));
  }

  /** Branches with their current headcount (active and invited members) */
  async listBranches(organizationId: string) {
    const branches = await this.prisma.branch.findMany({
      where: { organizationId },
      select: {
        id: true,
        name: true,
        address: true,
        _count: { select: { memberships: { where: { deletedAt: null } } } },
      },
      orderBy: { name: 'asc' },
    });
    return branches.map(({ _count, ...branch }) => ({
      ...branch,
      memberCount: _count.memberships,
    }));
  }

  /** Target must be a current member of *this* organization (IDOR protection) and below the caller */
  private async findManageableTarget(tx: Tx, ctx: OrgContext, userId: string) {
    const target = await tx.membership.findFirst({
      where: { organizationId: ctx.organizationId, userId, deletedAt: null },
      select: {
        id: true,
        roleId: true,
        role: { select: { key: true, level: true, organizationId: true } },
      },
    });
    if (!target) throw AppException.notFound('Member not found');

    if (!canManageLevel(ctx.role.level, target.role.level)) {
      throw AppException.forbidden(
        'You cannot manage members whose role is at or above your own',
        ErrorCode.RoleTooHigh,
      );
    }
    return target;
  }

  /** Role must be a system role or belong to this organization, and below the caller's */
  private async findAssignableRole(tx: Tx, ctx: OrgContext, roleId: string) {
    const role = await tx.role.findFirst({
      where: {
        id: roleId,
        OR: [{ organizationId: null }, { organizationId: ctx.organizationId }],
      },
      select: { id: true, key: true, level: true, organizationId: true },
    });
    if (!role) throw AppException.badRequest('Role not found', ['roleId is invalid']);

    if (!canManageLevel(ctx.role.level, role.level)) {
      throw AppException.forbidden(
        'You can only assign roles below your own',
        ErrorCode.RoleTooHigh,
      );
    }
    return role;
  }

  /**
   * The permission checks were made against the target's current role, which was
   * read without a lock. The write applies only if that role is still in place, so
   * e.g. a manager's edit can't land on someone who was promoted to admin meanwhile.
   */
  private async writeIfUnchanged(
    tx: Tx,
    target: { id: string; roleId: string },
    data: Prisma.MembershipUncheckedUpdateManyInput,
  ) {
    const { count } = await tx.membership.updateMany({
      where: { id: target.id, roleId: target.roleId, deletedAt: null },
      data,
    });
    if (count === 0) {
      throw AppException.conflict(
        ErrorCode.Conflict,
        'The member was changed by someone else at the same time. Reload and try again.',
      );
    }
  }

  /** Also enforced by the composite FK; checked here for a clear error message */
  private async ensureBranch(tx: Tx, organizationId: string, branchId: string) {
    const branch = await tx.branch.findFirst({
      where: { id: branchId, organizationId },
      select: { id: true },
    });
    if (!branch) throw AppException.badRequest('Branch not found', ['branchId is invalid']);
  }

  /**
   * Locks the organization's active admin memberships so concurrent demotions /
   * removals are serialized: two admins can't remove each other at the same time.
   */
  private async ensureNotLastAdmin(tx: Tx, organizationId: string, excludingMembershipId: string) {
    const admins = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT m.id
      FROM memberships m
      JOIN roles r ON r.id = m.role_id
      WHERE m.organization_id = ${organizationId}::uuid
        AND r.key = ${SystemRole.Admin}
        AND r.organization_id IS NULL
        AND m.deleted_at IS NULL
        AND m.status = 'active'
      FOR UPDATE OF m
    `;
    if (!admins.some((a) => a.id !== excludingMembershipId)) {
      throw AppException.conflict(
        ErrorCode.LastAdmin,
        'The organization must keep at least one active administrator',
      );
    }
  }
}
