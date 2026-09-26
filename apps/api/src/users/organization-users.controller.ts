import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Module, Permission } from '../access/access.constants.js';
import type { OrgContext } from '../access/access.types.js';
import { CurrentOrg, RequireModule, RequirePermissions } from '../access/decorators.js';
import { CreateMemberDto } from './dto/create-member.dto.js';
import { ListMembersQueryDto } from './dto/list-members.query.js';
import { UpdateMemberDto } from './dto/update-member.dto.js';
import { OrganizationUsersService } from './organization-users.service.js';

// Access to :organizationId itself is checked by the global OrganizationAccessGuard
@Controller('organizations/:organizationId/users')
@RequireModule(Module.Users)
export class OrganizationUsersController {
  constructor(private readonly users: OrganizationUsersService) {}

  @Get()
  @RequirePermissions(Permission.UsersRead)
  list(@CurrentOrg() org: OrgContext, @Query() query: ListMembersQueryDto) {
    return this.users.list(org.organizationId, query);
  }

  @Get(':userId')
  @RequirePermissions(Permission.UsersRead)
  get(@CurrentOrg() org: OrgContext, @Param('userId', ParseUUIDPipe) userId: string) {
    return this.users.get(org.organizationId, userId);
  }

  @Post()
  @RequirePermissions(Permission.UsersCreate)
  create(@CurrentOrg() org: OrgContext, @Body() dto: CreateMemberDto) {
    return this.users.create(org, dto);
  }

  @Patch(':userId')
  @RequirePermissions(Permission.UsersUpdate)
  update(
    @CurrentOrg() org: OrgContext,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.users.update(org, userId, dto);
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(Permission.UsersDelete)
  async remove(@CurrentOrg() org: OrgContext, @Param('userId', ParseUUIDPipe) userId: string) {
    await this.users.remove(org, userId);
  }
}
