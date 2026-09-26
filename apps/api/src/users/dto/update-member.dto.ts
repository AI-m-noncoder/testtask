import { IsOptional, IsUUID } from 'class-validator';

export class UpdateMemberDto {
  @IsOptional()
  @IsUUID('all')
  roleId?: string;

  /** `null` removes the member from their branch; omitted leaves it unchanged */
  @IsOptional()
  @IsUUID('all')
  branchId?: string | null;
}
