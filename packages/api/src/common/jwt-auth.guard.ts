import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AppError, PermissionCode } from '@workshopos/shared';
import { PrismaService } from '../prisma/prisma.service';
import { PUBLIC_KEY } from './decorators';

/**
 * Authenticates every request unless the route is @Public. Reads the access
 * token from the httpOnly cookie (web) or the Authorization header (devices),
 * verifies it, then loads the user's current permissions and attaches the
 * AuthUser to the request.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<Request>();
    const token = this.extractToken(req);
    if (!token) throw new AppError('UNAUTHENTICATED', 'Authentication required');

    let payload: { sub: string };
    try {
      payload = await this.jwt.verifyAsync(token, { secret: process.env.JWT_ACCESS_SECRET });
    } catch {
      throw new AppError('UNAUTHENTICATED', 'Invalid or expired session');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
    });
    if (!user || !user.isActive) throw new AppError('UNAUTHENTICATED', 'Account is inactive');

    const permissions = new Set<PermissionCode>();
    for (const ur of user.roles) {
      for (const rp of ur.role.permissions) {
        permissions.add(rp.permission.code as PermissionCode);
      }
    }

    (req as Request & { user: unknown }).user = {
      id: user.id,
      email: user.email,
      permissions: [...permissions],
    };
    return true;
  }

  private extractToken(req: Request): string | undefined {
    const cookieToken = (req.cookies as Record<string, string> | undefined)?.access_token;
    if (cookieToken) return cookieToken;
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) return auth.slice(7);
    return undefined;
  }
}
