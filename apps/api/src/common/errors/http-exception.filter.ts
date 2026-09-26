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
import { ErrorCode, type ErrorBody } from './error-codes.js';

const STATUS_TO_CODE: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: ErrorCode.ValidationError,
  [HttpStatus.UNAUTHORIZED]: ErrorCode.Unauthorized,
  [HttpStatus.FORBIDDEN]: ErrorCode.Forbidden,
  [HttpStatus.NOT_FOUND]: ErrorCode.NotFound,
  [HttpStatus.CONFLICT]: ErrorCode.Conflict,
};

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
          code: STATUS_TO_CODE[status] ?? ErrorCode.InternalError,
          message: Array.isArray(message) ? 'Validation failed' : String(message),
          ...(Array.isArray(message) && { details: message }),
        },
      ];
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
