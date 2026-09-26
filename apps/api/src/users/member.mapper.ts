import type { Prisma } from '../generated/prisma/client.js';
import type { MemberStatus } from './dto/list-members.query.js';

export const memberSelect = {
  createdAt: true,
  updatedAt: true,
  status: true,
  user: { select: { id: true, email: true, name: true } },
  role: { select: { id: true, key: true, name: true, level: true } },
  branch: { select: { id: true, name: true } },
} satisfies Prisma.MembershipSelect;

type MemberRow = Prisma.MembershipGetPayload<{ select: typeof memberSelect }>;

/**
 * API shape of an organization member. `id` is the user id (used in URLs);
 * only data scoped to this organization is exposed, never the user's other memberships.
 */
export function toMember(row: MemberRow) {
  return {
    id: row.user.id,
    email: row.user.email,
    name: row.user.name,
    status: (row.status === 'ACTIVE' ? 'active' : 'invited') satisfies MemberStatus,
    role: row.role,
    branch: row.branch,
    joinedAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
export type Member = ReturnType<typeof toMember>;
