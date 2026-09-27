import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const MEMBER_SORT_FIELDS = ['name', 'email', 'createdAt', 'role'] as const;
export type MemberSortField = (typeof MEMBER_SORT_FIELDS)[number];

export const MEMBER_STATUSES = ['active', 'invited'] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

/** Special branchId filter value: members without a branch */
export const NO_BRANCH = 'none';

const UUID_OR_NONE = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|none)$/i;

export class ListMembersQueryDto {
  // Upper bound keeps the offset (page × pageSize) within what the database accepts
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  page: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsUUID('all')
  roleId?: string;

  @IsOptional()
  @Matches(UUID_OR_NONE, { message: 'branchId must be a UUID or "none"' })
  branchId?: string;

  @IsOptional()
  @IsIn(MEMBER_STATUSES)
  status?: MemberStatus;

  // Whitelist: the value maps to a fixed orderBy, never to a raw column name
  @IsIn(MEMBER_SORT_FIELDS)
  sortBy: MemberSortField = 'name';

  @IsIn(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'asc';
}
