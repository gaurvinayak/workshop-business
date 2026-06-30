import { PrismaClient } from '@prisma/client';
import {
  ROLES,
  ROLE_DESCRIPTIONS,
  ROLE_PERMISSIONS,
  PERMISSIONS,
  DEFAULT_CHART_OF_ACCOUNTS,
  type RoleCode,
} from '@workshopos/shared';

const prisma = new PrismaClient();

/**
 * Seeds static reference data: permissions, roles, role→permission grants,
 * and the default chart of accounts. Idempotent — safe to run repeatedly.
 * Business-specific data (the company, fiscal year, owner user) is created by
 * the first-run setup wizard, not here.
 */
async function main() {
  // Permissions
  const permissionCodes = Object.values(PERMISSIONS);
  for (const code of permissionCodes) {
    await prisma.permission.upsert({
      where: { code },
      update: {},
      create: { code },
    });
  }

  // Roles + their permission grants
  for (const roleCode of Object.values(ROLES) as RoleCode[]) {
    const role = await prisma.role.upsert({
      where: { code: roleCode },
      update: { name: roleCode, description: ROLE_DESCRIPTIONS[roleCode] },
      create: { code: roleCode, name: roleCode, description: ROLE_DESCRIPTIONS[roleCode] },
    });

    const grants = ROLE_PERMISSIONS[roleCode];
    const perms = await prisma.permission.findMany({ where: { code: { in: grants } } });
    for (const perm of perms) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        update: {},
        create: { roleId: role.id, permissionId: perm.id },
      });
    }
  }

  // Default chart of accounts (parents first so parentId resolves).
  const byCode = new Map<string, string>();
  for (const acc of DEFAULT_CHART_OF_ACCOUNTS) {
    const parentId = acc.parentCode ? byCode.get(acc.parentCode) ?? null : null;
    const row = await prisma.account.upsert({
      where: { code: acc.code },
      update: { name: acc.name, type: acc.type, parentId, isPostable: acc.isPostable, isSystem: acc.system ?? false },
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

  // Operational defaults so the app is usable out of the box.
  await prisma.uom.upsert({ where: { name: 'Piece' }, update: {}, create: { name: 'Piece', symbol: 'pcs' } });
  await prisma.uom.upsert({ where: { name: 'Kilogram' }, update: {}, create: { name: 'Kilogram', symbol: 'kg' } });

  const existingLocation = await prisma.location.findFirst({ where: { name: 'Main Store' } });
  if (!existingLocation) await prisma.location.create({ data: { name: 'Main Store', type: 'STORE' } });

  for (const lt of [
    { name: 'Casual Leave', paid: true, annualQuota: 12 },
    { name: 'Sick Leave', paid: true, annualQuota: 12 },
    { name: 'Unpaid Leave', paid: false, annualQuota: 0 },
  ]) {
    await prisma.leaveType.upsert({ where: { name: lt.name }, update: {}, create: lt });
  }

  for (const comp of [
    { name: 'Basic', type: 'EARNING' as const, calc: 'FIXED', taxable: true },
    { name: 'HRA', type: 'EARNING' as const, calc: 'PERCENT_OF_BASIC', taxable: true },
    { name: 'Provident Fund', type: 'DEDUCTION' as const, calc: 'PERCENT_OF_BASIC', taxable: false },
  ]) {
    await prisma.salaryComponent.upsert({ where: { name: comp.name }, update: {}, create: comp });
  }

  // eslint-disable-next-line no-console
  console.log(
    `Seeded ${permissionCodes.length} permissions, ${Object.keys(ROLES).length} roles, ${DEFAULT_CHART_OF_ACCOUNTS.length} accounts, plus operational defaults.`,
  );
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
