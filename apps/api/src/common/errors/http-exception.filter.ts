import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '../../generated/prisma/client.js';
import { AppException } from './app.exception.js';
import { ErrorCode, type ErrorBody } from './error-codes.js';

const STATUS_TO_CODE: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: ErrorCode.ValidationError,
  [HttpStatus.UNAUTHORIZED]: ErrorCode.Unauthorized,
  [HttpStatus.FORBIDDEN]: ErrorCode.Forbidden,
  [HttpStatus.NOT_FOUND]: ErrorCode.NotFound,
  [HttpStatus.CONFLICT]: ErrorCode.Conflict,
  [HttpStatus.PAYLOAD_TOO_LARGE]: ErrorCode.PayloadTooLarge,
  [HttpStatus.TOO_MANY_REQUESTS]: ErrorCode.TooManyRequests,
};

const codeFor = (status: number) =>
  STATUS_TO_CODE[status] ?? (status < 500 ? ErrorCode.BadRequest : ErrorCode.InternalError);

/** Errors from Express middleware (body-parser: too large, bad encoding, …) */
const isClientHttpError = (error: unknown): error is Error & { status: number; expose: boolean } =>
  error instanceof Error &&
  'status' in error &&
  typeof error.status === 'number' &&
  error.status >= 400 &&
  error.status < 500 &&
  'expose' in error &&
  error.expose === true;

/** Every error leaves the API as `{ code, message, details? }` */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const [status, body] = this.toResponse(exception);
    if (status >= 500) {
      this.logger.error(exception instanceof Error ? exception.stack : exception);
    }
    if (exception instanceof AppException && exception.headers) res.set(exception.headers);
    res.status(status).json(body);
  }

  private toResponse(exception: unknown): [number, ErrorBody] {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      if (typeof response === 'object' && response !== null && 'code' in response) {
        return [status, response as ErrorBody];
      }
      const message =
        typeof response === 'object' && response !== null && 'message' in response
          ? (response as { message: unknown }).message
          : exception.message;
      return [
        status,
        {
          code: codeFor(status),
          message: Array.isArray(message) ? 'Validation failed' : String(message),
          ...(Array.isArray(message) && { details: message }),
        },
      ];
    }

    if (isClientHttpError(exception)) {
      return [exception.status, { code: codeFor(exception.status), message: exception.message }];
    }

    // Safety net for races the services didn't catch (e.g. concurrent inserts)
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return [
          HttpStatus.CONFLICT,
          { code: ErrorCode.Conflict, message: 'Resource already exists' },
        ];
      }
      if (exception.code === 'P2003') {
        return [
          HttpStatus.BAD_REQUEST,
          { code: ErrorCode.ValidationError, message: 'Referenced resource does not exist' },
        ];
      }
    }

    return [
      HttpStatus.INTERNAL_SERVER_ERROR,
      { code: ErrorCode.InternalError, message: 'Internal server error' },
    ];
  }
}
