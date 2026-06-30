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

  // eslint-disable-next-line no-console
  console.log(
    `Seeded ${permissionCodes.length} permissions, ${Object.keys(ROLES).length} roles, ${DEFAULT_CHART_OF_ACCOUNTS.length} accounts.`,
  );
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
