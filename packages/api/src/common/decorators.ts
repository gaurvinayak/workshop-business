import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { PermissionCode } from '@workshopos/shared';

/** Marks a route as not requiring authentication. */
export const PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(PUBLIC_KEY, true);

/** Declares the permission(s) a route requires. Enforced by PermissionsGuard. */
export const PERMISSIONS_KEY = 'requiredPermissions';
export const RequirePermissions = (...perms: PermissionCode[]) => SetMetadata(PERMISSIONS_KEY, perms);

export interface AuthUser {
  id: string;
  email: string;
  permissions: PermissionCode[];
}

/** Injects the authenticated user (set by JwtAuthGuard) into a handler. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser | undefined => {
  const req = ctx.switchToHttp().getRequest();
  return req.user;
});
