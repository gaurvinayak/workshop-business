/**
 * Roles and permissions. Single source of truth, consumed by:
 *  - the API seed (creates these rows)
 *  - the API permission guard (checks codes)
 *  - the web app (hides UI the user can't use)
 *
 * Phase 0 ships auth + accounting permissions. Later phases append their own
 * codes here as modules land.
 */

export const ROLES = {
  OWNER: 'owner',
  ACCOUNTS: 'accounts',
  STORE: 'store',
  SUPERVISOR: 'supervisor',
  EMPLOYEE: 'employee',
} as const;

export type RoleCode = (typeof ROLES)[keyof typeof ROLES];

export const PERMISSIONS = {
  // user & access management
  USER_VIEW: 'user.view',
  USER_MANAGE: 'user.manage',
  ROLE_MANAGE: 'role.manage',
  AUDIT_VIEW: 'audit.view',

  // business setup / settings
  SETTINGS_VIEW: 'settings.view',
  SETTINGS_MANAGE: 'settings.manage',

  // accounting
  ACCOUNT_VIEW: 'account.view',
  ACCOUNT_MANAGE: 'account.manage',
  JOURNAL_VIEW: 'journal.view',
  JOURNAL_POST: 'journal.post',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const ALL = Object.values(PERMISSIONS) as PermissionCode[];

/** Default permission grants per role. The owner gets everything. */
export const ROLE_PERMISSIONS: Record<RoleCode, PermissionCode[]> = {
  [ROLES.OWNER]: ALL,
  [ROLES.ACCOUNTS]: [
    PERMISSIONS.SETTINGS_VIEW,
    PERMISSIONS.ACCOUNT_VIEW,
    PERMISSIONS.ACCOUNT_MANAGE,
    PERMISSIONS.JOURNAL_VIEW,
    PERMISSIONS.JOURNAL_POST,
    PERMISSIONS.USER_VIEW,
  ],
  [ROLES.STORE]: [PERMISSIONS.SETTINGS_VIEW],
  [ROLES.SUPERVISOR]: [PERMISSIONS.SETTINGS_VIEW],
  [ROLES.EMPLOYEE]: [],
};

export const ROLE_DESCRIPTIONS: Record<RoleCode, string> = {
  [ROLES.OWNER]: 'Business owner — full access to everything',
  [ROLES.ACCOUNTS]: 'Office/accounts staff — invoices, purchases, payroll, ledger',
  [ROLES.STORE]: 'Stores in-charge — inventory and stock',
  [ROLES.SUPERVISOR]: 'Floor supervisor — attendance and team',
  [ROLES.EMPLOYEE]: 'Workshop employee — clock in/out, own payslips',
};
