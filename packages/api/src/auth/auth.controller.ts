import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { loginSchema, LoginInput } from '@workshopos/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { Public, CurrentUser, AuthUser } from '../common/decorators';
import { AuthService, AuthResult } from './auth.service';

// Secure cookies by default in production, but allow an explicit override so a
// local self-host over plain http://localhost still works (set COOKIE_SECURE=false).
const secureCookies =
  process.env.COOKIE_SECURE !== undefined
    ? process.env.COOKIE_SECURE === 'true'
    : process.env.NODE_ENV === 'production';

function setAuthCookies(res: Response, result: AuthResult) {
  res.cookie('access_token', result.accessToken, {
    httpOnly: true,
    secure: secureCookies,
    sameSite: 'lax',
    maxAge: Number(process.env.JWT_ACCESS_TTL ?? 900) * 1000,
    path: '/',
  });
  res.cookie('refresh_token', result.refreshToken, {
    httpOnly: true,
    secure: secureCookies,
    sameSite: 'lax',
    maxAge: Number(process.env.JWT_REFRESH_TTL ?? 60 * 60 * 24 * 30) * 1000,
    path: '/api/v1/auth',
  });
}

function clearAuthCookies(res: Response) {
  res.clearCookie('access_token', { path: '/' });
  res.clearCookie('refresh_token', { path: '/api/v1/auth' });
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(body);
    setAuthCookies(res, result);
    return { user: result.user };
  }

  @Public()
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = (req.cookies as Record<string, string> | undefined)?.refresh_token;
    const result = await this.auth.refresh(raw);
    setAuthCookies(res, result);
    return { user: result.user };
  }

  @Public()
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = (req.cookies as Record<string, string> | undefined)?.refresh_token;
    await this.auth.logout(raw);
    clearAuthCookies(res);
    return { ok: true };
  }

  /** Who am I — used by the web app to bootstrap session state. */
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return { id: user.id, email: user.email, permissions: user.permissions };
  }
}
