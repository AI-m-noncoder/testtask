import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode, type ErrorBody } from './error-codes.js';

/** Domain error with a stable machine-readable code the frontend can rely on */
export class AppException extends HttpException {
  constructor(
    status: HttpStatus,
    code: ErrorCode,
    message: string,
    details?: unknown,
    /** Extra response headers, e.g. Retry-After */
    readonly headers?: Record<string, string>,
  ) {
    super({ code, message, details } satisfies ErrorBody, status);
  }

  static notFound(message = 'Not found') {
    return new AppException(HttpStatus.NOT_FOUND, ErrorCode.NotFound, message);
  }

  static forbidden(
    message = 'You do not have permission to perform this action',
    code: ErrorCode = ErrorCode.Forbidden,
  ) {
    return new AppException(HttpStatus.FORBIDDEN, code, message);
  }

  static conflict(code: ErrorCode, message: string) {
    return new AppException(HttpStatus.CONFLICT, code, message);
  }

  static badRequest(message: string, details?: unknown) {
    return new AppException(HttpStatus.BAD_REQUEST, ErrorCode.ValidationError, message, details);
  }

  static unauthorized(message = 'Authentication required') {
    return new AppException(HttpStatus.UNAUTHORIZED, ErrorCode.Unauthorized, message);
  }
}
