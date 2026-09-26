import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AppException } from '../common/errors/app.exception.js';
import type { AuthUser, JwtPayload } from './auth.types.js';
import { IS_PUBLIC_KEY } from './decorators.js';

/** Global guard: every route requires a valid Bearer token unless marked @Public() */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const [scheme, token] = req.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) throw AppException.unauthorized();

    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token);
      req.user = { userId: payload.sub };
    } catch {
      throw AppException.unauthorized('Invalid or expired token');
    }
    return true;
  }
}
