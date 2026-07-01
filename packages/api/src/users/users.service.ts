import { Injectable } from '@nestjs/common';
import {
  AppError,
  PaginationQuery,
  paginate,
  toSkipTake,
  CreateUserInput,
  UpdateUserInput,
  SetUserRolesInput,
  ResetPasswordInput,
  ROLES,
} from '@workshopos/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';

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
    const data = rows.map((u) => this.toDto(u));
    return paginate(data, total, q);
  }

  async listRoles() {
    const roles = await this.prisma.role.findMany({
      orderBy: { name: 'asc' },
      include: { permissions: { include: { permission: true } } },
    });
    return roles.map((r) => ({
      code: r.code,
      name: r.name,
      description: r.description,
      permissions: r.permissions.map((p) => p.permission.code),
    }));
  }

  async create(input: CreateUserInput) {
    const email = input.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw AppError.conflict('A user with that email already exists');

    const roles = await this.prisma.role.findMany({ where: { code: { in: input.roles } } });
    if (roles.length !== new Set(input.roles).size) throw AppError.validation('One or more roles are unknown');

    const passwordHash = await AuthService.hashPassword(input.password);

    const user = await this.prisma.$transaction(async (tx) => {
      return tx.user.create({
        data: {
          email,
          name: input.name,
          passwordHash,
          roles: { create: roles.map((r) => ({ roleId: r.id })) },
        },
        include: { roles: { include: { role: true } } },
      });
    });

    return this.toDto(user);
  }

  async update(id: string, input: UpdateUserInput, currentUserId: string) {
    const user = await this.getOrThrow(id);

    if (input.isActive === false) {
      if (id === currentUserId) throw AppError.conflict('You cannot deactivate your own account');
      const isOwner = user.roles.some((r) => r.role.code === ROLES.OWNER);
      if (isOwner) await this.assertOtherActiveOwnerExists(id);
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        name: input.name,
        isActive: input.isActive,
      },
      include: { roles: { include: { role: true } } },
    });
    return this.toDto(updated);
  }

  async setRoles(id: string, input: SetUserRolesInput) {
    const user = await this.getOrThrow(id);

    const roles = await this.prisma.role.findMany({ where: { code: { in: input.roles } } });
    if (roles.length !== new Set(input.roles).size) throw AppError.validation('One or more roles are unknown');

    const hadOwner = user.roles.some((r) => r.role.code === ROLES.OWNER);
    const willHaveOwner = roles.some((r) => r.code === ROLES.OWNER);
    if (hadOwner && !willHaveOwner) {
      await this.assertOtherActiveOwnerExists(id);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId: id } });
      await tx.userRole.createMany({ data: roles.map((r) => ({ userId: id, roleId: r.id })) });
      return tx.user.findUniqueOrThrow({
        where: { id },
        include: { roles: { include: { role: true } } },
      });
    });
    return this.toDto(updated);
  }

  async resetPassword(id: string, input: ResetPasswordInput) {
    await this.getOrThrow(id);
    const passwordHash = await AuthService.hashPassword(input.password);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { passwordHash } });
      await tx.refreshToken.deleteMany({ where: { userId: id } });
    });

    return { ok: true };
  }

  private async getOrThrow(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { roles: { include: { role: true } } },
    });
    if (!user) throw AppError.notFound('User');
    return user;
  }

  /**
   * Guards the "at least one active owner" invariant: throws if `excludeUserId`
   * is currently the only active owner left.
   */
  private async assertOtherActiveOwnerExists(excludeUserId: string) {
    const otherActiveOwners = await this.prisma.user.count({
      where: {
        id: { not: excludeUserId },
        isActive: true,
        roles: { some: { role: { code: ROLES.OWNER } } },
      },
    });
    if (otherActiveOwners === 0) throw AppError.conflict('At least one active owner is required');
  }

  private toDto(u: {
    id: string;
    email: string;
    name: string;
    isActive: boolean;
    createdAt: Date;
    roles: { role: { code: string } }[];
  }) {
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      isActive: u.isActive,
      roles: u.roles.map((r) => r.role.code),
      createdAt: u.createdAt,
    };
  }
}
