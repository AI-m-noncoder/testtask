import { Controller, Get } from '@nestjs/common';
import { Module, Permission } from '../access/access.constants.js';
import type { OrgContext } from '../access/access.types.js';
import { CurrentOrg, RequireModule, RequirePermissions } from '../access/decorators.js';
import { OrganizationUsersService } from './organization-users.service.js';

/** Reference data for the users page: filters and add/edit forms */
@Controller('organizations/:organizationId')
@RequireModule(Module.Users)
@RequirePermissions(Permission.UsersRead)
export class OrganizationDirectoryController {
  constructor(private readonly users: OrganizationUsersService) {}

  @Get('roles')
  roles(@CurrentOrg() org: OrgContext) {
    return this.users.listRoles(org);
  }

  @Get('branches')
  branches(@CurrentOrg() org: OrgContext) {
    return this.users.listBranches(org.organizationId);
  }
}
