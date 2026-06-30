import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Issues short-lived access JWTs and opaque, rotating refresh tokens.
 * Refresh tokens are stored only as a SHA-256 hash (they're high-entropy, so
 * a fast hash is fine for lookup) and rotated on every use.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async issueAccessToken(userId: string): Promise<string> {
    return this.jwt.signAsync(
      { sub: userId },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: Number(process.env.JWT_ACCESS_TTL ?? 900) },
    );
  }

  async issueRefreshToken(userId: string): Promise<string> {
    const raw = randomBytes(48).toString('hex');
    const ttl = Number(process.env.JWT_REFRESH_TTL ?? 60 * 60 * 24 * 30);
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hash(raw),
        expiresAt: new Date(Date.now() + ttl * 1000),
      },
    });
    return raw;
  }

  /** Validate + rotate. Returns the userId if valid, else null. */
  async rotateRefreshToken(raw: string): Promise<{ userId: string; newToken: string } | null> {
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash: this.hash(raw) } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) return null;

    await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    const newToken = await this.issueRefreshToken(stored.userId);
    return { userId: stored.userId, newToken };
  }

  async revokeRefreshToken(raw: string): Promise<void> {
    await this.prisma.refreshToken
      .updateMany({ where: { tokenHash: this.hash(raw), revokedAt: null }, data: { revokedAt: new Date() } })
      .catch(() => undefined);
  }
}
