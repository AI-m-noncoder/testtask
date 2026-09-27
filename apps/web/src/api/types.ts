// Mirrors the API response shapes (apps/api)

export interface Role {
  id: string;
  key: string;
  name: string;
  level: number;
}

export interface RoleOption extends Role {
  /** Whether the current user may assign this role */
  assignable: boolean;
}

/** A member's branch */
export interface BranchRef {
  id: string;
  name: string;
  address: string | null;
}

/** GET /branches: also the number of current members */
export interface Branch extends BranchRef {
  memberCount: number;
}

export interface Me {
  id: string;
  email: string;
  name: string;
}

export interface MyOrganization {
  id: string;
  name: string;
  role: Role;
  permissions: string[];
  modules: string[];
}

export type MemberStatus = 'active' | 'invited';

export interface Member {
  id: string;
  email: string;
  name: string;
  status: MemberStatus;
  role: Role;
  branch: BranchRef | null;
  joinedAt: string;
  updatedAt: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type MemberSortField = 'name' | 'email' | 'createdAt' | 'role';
export type SortOrder = 'asc' | 'desc';

export interface MembersQuery {
  page: number;
  pageSize: number;
  search?: string;
  roleId?: string;
  /** A branch id, or "none" for members without a branch */
  branchId?: string;
  status?: MemberStatus;
  sortBy: MemberSortField;
  sortOrder: SortOrder;
}

export interface CreateMemberInput {
  email: string;
  name?: string;
  roleId: string;
  branchId?: string;
}

export interface UpdateMemberInput {
  roleId?: string;
  branchId?: string | null;
}
