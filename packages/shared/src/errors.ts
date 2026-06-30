/**
 * Canonical error envelope shared by API and web.
 * The API serializes thrown AppErrors into this shape; the web client
 * parses it back.
 */
export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL';

export interface ErrorEnvelope {
  error: {
    code: ErrorCode;
    message: string;
    fields?: Record<string, string>;
  };
}

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 422,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly fields?: Record<string, string>;

  constructor(code: ErrorCode, message: string, fields?: Record<string, string>) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.fields = fields;
  }

  get httpStatus(): number {
    return STATUS_BY_CODE[this.code];
  }

  toEnvelope(): ErrorEnvelope {
    return { error: { code: this.code, message: this.message, fields: this.fields } };
  }

  static notFound(what = 'Resource') {
    return new AppError('NOT_FOUND', `${what} not found`);
  }
  static forbidden(message = 'You do not have permission to do that') {
    return new AppError('FORBIDDEN', message);
  }
  static conflict(message: string) {
    return new AppError('CONFLICT', message);
  }
  static validation(message: string, fields?: Record<string, string>) {
    return new AppError('VALIDATION_ERROR', message, fields);
  }
}
