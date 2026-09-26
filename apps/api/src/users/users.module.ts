import { Module } from '@nestjs/common';
import { OrganizationDirectoryController } from './organization-directory.controller.js';
import { OrganizationUsersController } from './organization-users.controller.js';
import { OrganizationUsersService } from './organization-users.service.js';

@Module({
  controllers: [OrganizationUsersController, OrganizationDirectoryController],
  providers: [OrganizationUsersService],
})
export class UsersModule {}
