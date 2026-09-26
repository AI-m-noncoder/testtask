import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AccessModule } from './access/access.module.js';
import { OrganizationAccessGuard } from './access/organization-access.guard.js';
import { AuthModule } from './auth/auth.module.js';
import { JwtAuthGuard } from './auth/jwt-auth.guard.js';
import { validateEnv } from './config.js';
import { HealthController } from './health/health.controller.js';
import { MeModule } from './me/me.module.js';
import { UsersModule } from './users/users.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    AuthModule,
    AccessModule,
    MeModule,
    UsersModule,
  ],
  controllers: [HealthController],
  providers: [
    // Order matters: authenticate first, then check organization access
    { provide: APP_GUARD, useExisting: JwtAuthGuard },
    { provide: APP_GUARD, useExisting: OrganizationAccessGuard },
  ],
})
export class AppModule {}
