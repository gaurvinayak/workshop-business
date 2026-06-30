import { ExceptionFilter, Catch, ArgumentsHost, HttpException, Logger } from '@nestjs/common';
import { Response } from 'express';
import { AppError, ErrorEnvelope } from '@workshopos/shared';

/**
 * Translates every thrown error into the shared ErrorEnvelope so the web
 * client always sees a consistent shape. Unknown errors become a 500 without
 * leaking internals.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof AppError) {
      return res.status(exception.httpStatus).json(exception.toEnvelope());
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body: ErrorEnvelope = {
        error: {
          code: status === 401 ? 'UNAUTHENTICATED' : status === 403 ? 'FORBIDDEN' : status === 404 ? 'NOT_FOUND' : 'INTERNAL',
          message: exception.message,
        },
      };
      return res.status(status).json(body);
    }

    this.logger.error('Unhandled exception', exception instanceof Error ? exception.stack : String(exception));
    const body: ErrorEnvelope = { error: { code: 'INTERNAL', message: 'Something went wrong' } };
    return res.status(500).json(body);
  }
}
