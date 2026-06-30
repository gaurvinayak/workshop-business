import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from './decorators';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Records an append-only audit row for every successful mutating request:
 * who did what, when, and from where. Read requests are not logged.
 * Failures are swallowed — auditing must never break the request.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    if (!MUTATING.has(req.method)) return next.handle();

    return next.handle().pipe(
      tap((result) => {
        const entityId =
          result && typeof result === 'object' && 'id' in result ? String((result as { id: unknown }).id) : undefined;
        this.prisma.auditLog
          .create({
            data: {
              userId: req.user?.id,
              action: `${req.method} ${req.path}`,
              entity: req.path.split('/').filter(Boolean).slice(-2, -1)[0],
              entityId,
              ip: req.ip,
            },
          })
          .catch(() => undefined);
      }),
    );
  }
}
