export const ErrorCode = {
  Unauthorized: 'UNAUTHORIZED',
  Forbidden: 'FORBIDDEN',
  ModuleDisabled: 'MODULE_DISABLED',
  NotFound: 'NOT_FOUND',
  ValidationError: 'VALIDATION_ERROR',
  Conflict: 'CONFLICT',
  AlreadyMember: 'ALREADY_MEMBER',
  LastAdmin: 'LAST_ADMIN',
  RoleTooHigh: 'ROLE_TOO_HIGH',
  PayloadTooLarge: 'PAYLOAD_TOO_LARGE',
  TooManyRequests: 'TOO_MANY_REQUESTS',
  BadRequest: 'BAD_REQUEST',
  InternalError: 'INTERNAL_ERROR',
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface ErrorBody {
  code: ErrorCode;
  message: string;
  details?: unknown;
}
