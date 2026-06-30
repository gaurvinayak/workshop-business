import { Injectable } from '@nestjs/common';
import {
  AppError,
  SetupInput,
  ROLES,
  ROLE_DESCRIPTIONS,
  ROLE_PERMISSIONS,
  PERMISSIONS,
  DEFAULT_CHART_OF_ACCOUNTS,
  type RoleCode,
} from '@workshopos/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class SetupService {
  constructor(private readonly prisma: PrismaService) {}

  async status() {
    const business = await this.prisma.businessSetting.findFirst();
    return { isSetup: !!business, businessName: business?.name ?? null };
  }

  /**
   * One-shot first-run wizard. Idempotently ensures reference data (roles,
   * permissions, chart of accounts) exists, then creates the business profile,
   * the first fiscal year, and the owner account. Refuses to run twice.
   */
  async run(input: SetupInput) {
    const existing = await this.prisma.businessSetting.findFirst();
    if (existing) throw AppError.conflict('WorkshopOS has already been set up');

    if (input.fiscalYear.endDate <= input.fiscalYear.startDate) {
      throw AppError.validation('Fiscal year end must be after its start');
    }

    const emailTaken = await this.prisma.user.findUnique({ where: { email: input.owner.email.toLowerCase() } });
    if (emailTaken) throw AppError.conflict('That email is already registered');

    const passwordHash = await AuthService.hashPassword(input.owner.password);

    return this.prisma.$transaction(async (tx) => {
      await this.ensureReferenceData(tx);

      const business = await tx.businessSetting.create({
        data: {
          name: input.business.name,
          currency: input.business.currency.toUpperCase(),
          timezone: input.business.timezone,
          taxId: input.business.taxId,
        },
      });

      await tx.fiscalYear.create({
        data: {
          name: input.fiscalYear.name,
          startDate: new Date(input.fiscalYear.startDate),
          endDate: new Date(input.fiscalYear.endDate),
          status: 'OPEN',
        },
      });

      const ownerRole = await tx.role.findUniqueOrThrow({ where: { code: ROLES.OWNER } });
      const user = await tx.user.create({
        data: {
          email: input.owner.email.toLowerCase(),
          name: input.owner.name,
          passwordHash,
          roles: { create: { roleId: ownerRole.id } },
        },
      });

      return { business: { id: business.id, name: business.name }, owner: { id: user.id, email: user.email } };
    });
  }

  /** Idempotent: creates permissions, roles+grants, and the default COA if absent. */
  private async ensureReferenceData(tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0]) {
    for (const code of Object.values(PERMISSIONS)) {
      await tx.permission.upsert({ where: { code }, update: {}, create: { code } });
    }

    for (const roleCode of Object.values(ROLES) as RoleCode[]) {
      const role = await tx.role.upsert({
        where: { code: roleCode },
        update: { name: roleCode, description: ROLE_DESCRIPTIONS[roleCode] },
        create: { code: roleCode, name: roleCode, description: ROLE_DESCRIPTIONS[roleCode] },
      });
      const perms = await tx.permission.findMany({ where: { code: { in: ROLE_PERMISSIONS[roleCode] } } });
      for (const perm of perms) {
        await tx.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
          update: {},
          create: { roleId: role.id, permissionId: perm.id },
        });
      }
    }

    const byCode = new Map<string, string>();
    for (const acc of DEFAULT_CHART_OF_ACCOUNTS) {
      const parentId = acc.parentCode ? byCode.get(acc.parentCode) ?? null : null;
      const row = await tx.account.upsert({
        where: { code: acc.code },
        update: {},
        create: {
          code: acc.code,
          name: acc.name,
          type: acc.type,
          parentId,
          isPostable: acc.isPostable,
          isSystem: acc.system ?? false,
        },
      });
      byCode.set(acc.code, row.id);
    }
  }
}
