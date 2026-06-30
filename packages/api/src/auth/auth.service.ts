import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AppError, LoginInput } from '@workshopos/shared';
import { PrismaService } from '../prisma/prisma.service';
import { TokenService } from './token.service';

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; name: string; roles: string[] };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  static hashPassword(plain: string): Promise<string> {
    return argon2.hash(plain, { type: argon2.argon2id });
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
      include: { roles: { include: { role: true } } },
    });

    // Verify even when the user is missing to blunt timing/enumeration attacks.
    const hash = user?.passwordHash ?? '$argon2id$v=19$m=65536,t=3,p=4$0000000000000000000000$0000000000000000000000000000000000000000000';
    const ok = await argon2.verify(hash, input.password).catch(() => false);

    if (!user || !ok || !user.isActive) {
      throw new AppError('UNAUTHENTICATED', 'Invalid email or password');
    }

    return this.buildResult(user.id, user.email, user.name, user.roles.map((r) => r.role.code));
  }

  async refresh(rawRefreshToken: string | undefined): Promise<AuthResult> {
    if (!rawRefreshToken) throw new AppError('UNAUTHENTICATED', 'Missing refresh token');
    const rotated = await this.tokens.rotateRefreshToken(rawRefreshToken);
    if (!rotated) throw new AppError('UNAUTHENTICATED', 'Invalid or expired refresh token');

    const user = await this.prisma.user.findUnique({
      where: { id: rotated.userId },
      include: { roles: { include: { role: true } } },
    });
    if (!user || !user.isActive) throw new AppError('UNAUTHENTICATED', 'Account is inactive');

    const accessToken = await this.tokens.issueAccessToken(user.id);
    return {
      accessToken,
      refreshToken: rotated.newToken,
      user: { id: user.id, email: user.email, name: user.name, roles: user.roles.map((r) => r.role.code) },
    };
  }

  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (rawRefreshToken) await this.tokens.revokeRefreshToken(rawRefreshToken);
  }

  private async buildResult(id: string, email: string, name: string, roles: string[]): Promise<AuthResult> {
    const [accessToken, refreshToken] = await Promise.all([
      this.tokens.issueAccessToken(id),
      this.tokens.issueRefreshToken(id),
    ]);
    return { accessToken, refreshToken, user: { id, email, name, roles } };
  }
}
