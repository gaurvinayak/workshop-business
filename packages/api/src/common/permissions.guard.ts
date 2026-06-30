import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppError, PermissionCode } from '@workshopos/shared';
import { PERMISSIONS_KEY, AuthUser } from './decorators';

/**
 * Enforces @RequirePermissions on a route. Runs after JwtAuthGuard, so
 * req.user is populated. UI hiding is convenience; this is the real gate.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<PermissionCode[]>(PERMISSIONS_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const user = ctx.switchToHttp().getRequest().user as AuthUser | undefined;
    if (!user) throw new AppError('UNAUTHENTICATED', 'Authentication required');

    const granted = new Set(user.permissions);
    const ok = required.every((p) => granted.has(p));
    if (!ok) throw AppError.forbidden();
    return true;
  }
}
