import { Controller, Get } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators.js';
import { MeService } from './me.service.js';

@Controller('me')
export class MeController {
  constructor(private readonly me: MeService) {}

  @Get()
  profile(@CurrentUser() user: AuthUser) {
    return this.me.getProfile(user.userId);
  }

  @Get('organizations')
  organizations(@CurrentUser() user: AuthUser) {
    return this.me.getOrganizations(user.userId);
  }
}
