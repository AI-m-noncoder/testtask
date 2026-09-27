import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { AppException } from '../common/errors/app.exception.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { JwtPayload } from './auth.types.js';
import { LoginThrottleService } from './login-throttle.service.js';
import type { LoginDto } from './login.dto.js';

// Compared against when the user doesn't exist, so response time doesn't reveal
// which emails are registered
const DUMMY_HASH = bcrypt.hashSync('timing-safe-dummy', 10);

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly throttle: LoginThrottleService,
  ) {}

  async login({ email, password }: LoginDto) {
    this.throttle.hit(email);
    const user = await this.prisma.user.findUnique({ where: { email } });
    const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    // Invited users have no password yet and can't log in
    if (!user?.passwordHash || !valid) {
      throw AppException.unauthorized('Invalid email or password');
    }
    this.throttle.reset(email);

    const payload: JwtPayload = { sub: user.id };
    return { accessToken: await this.jwt.signAsync(payload) };
  }
}
