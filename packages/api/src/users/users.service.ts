import { Injectable } from '@nestjs/common';
import { PaginationQuery, paginate, toSkipTake } from '@workshopos/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: PaginationQuery) {
    const { skip, take } = toSkipTake(q);
    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take,
        orderBy: { createdAt: 'asc' },
        include: { roles: { include: { role: true } } },
      }),
      this.prisma.user.count(),
    ]);
    const data = rows.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      isActive: u.isActive,
      roles: u.roles.map((r) => r.role.code),
      createdAt: u.createdAt,
    }));
    return paginate(data, total, q);
  }
}
