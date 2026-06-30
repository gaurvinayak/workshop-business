import { Controller, Get } from '@nestjs/common';
import { AppError } from '@workshopos/shared';
import { Public } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';

@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get('healthz')
  liveness() {
    return { status: 'ok' };
  }

  @Public()
  @Get('readyz')
  async readiness() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new AppError('INTERNAL', 'Database not reachable');
    }
    return { status: 'ready' };
  }
}
