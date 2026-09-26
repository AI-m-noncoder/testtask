import { Global, Module } from '@nestjs/common';
import { AccessService } from './access.service.js';
import { OrganizationAccessGuard } from './organization-access.guard.js';

@Global()
@Module({
  providers: [AccessService, OrganizationAccessGuard],
  exports: [AccessService, OrganizationAccessGuard],
})
export class AccessModule {}
