import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../common/errors/app.exception.js';
import { ErrorCode } from '../common/errors/error-codes.js';

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
// Bounds memory if someone sprays random emails
const SWEEP_THRESHOLD = 10_000;

/**
 * Limits password guessing per account: at most MAX_ATTEMPTS logins per email per
 * window; a successful login clears the counter.
 *
 * Keyed by email, not IP: behind the nginx proxy every client has the same IP, and
 * X-Forwarded-For can't be trusted while the API port is reachable directly.
 * In-memory, so per process; a multi-instance deployment would keep this in Redis.
 */
@Injectable()
export class LoginThrottleService {
  private readonly attempts = new Map<string, { count: number; resetAt: number }>();

  /** Counts an attempt before the password is checked, so parallel requests can't bypass it */
  hit(email: string, now = Date.now()) {
    let entry = this.attempts.get(email);
    if (!entry || entry.resetAt <= now) {
      if (this.attempts.size >= SWEEP_THRESHOLD) this.sweep(now);
      entry = { count: 0, resetAt: now + WINDOW_MS };
      this.attempts.set(email, entry);
    }
    entry.count++;
    if (entry.count > MAX_ATTEMPTS) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      throw new AppException(
        HttpStatus.TOO_MANY_REQUESTS,
        ErrorCode.TooManyRequests,
        'Too many login attempts. Try again later.',
        undefined,
        { 'Retry-After': String(retryAfter) },
      );
    }
  }

  reset(email: string) {
    this.attempts.delete(email);
  }

  private sweep(now: number) {
    for (const [key, entry] of this.attempts) {
      if (entry.resetAt <= now) this.attempts.delete(key);
    }
  }
}
