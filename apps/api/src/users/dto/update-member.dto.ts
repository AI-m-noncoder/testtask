import { IsOptional, IsUUID, ValidateIf } from 'class-validator';

export class UpdateMemberDto {
  // Not @IsOptional(): it would also let `null` through, and a member always has a role
  @ValidateIf((_, value) => value !== undefined)
  @IsUUID('all')
  roleId?: string;

  /** `null` removes the member from their branch; omitted leaves it unchanged */
  @IsOptional()
  @IsUUID('all')
  branchId?: string | null;
}
