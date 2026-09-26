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
  InternalError: 'INTERNAL_ERROR',
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface ErrorBody {
  code: ErrorCode;
  message: string;
  details?: unknown;
}
