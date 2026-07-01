/**
 * Roles and permissions. Single source of truth, consumed by:
 *  - the API seed (creates these rows)
 *  - the API permission guard (checks codes)
 *  - the web app (hides UI the user can't use)
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
  REPORT_VIEW: 'report.view',

  // HR
  EMPLOYEE_VIEW: 'employee.view',
  EMPLOYEE_MANAGE: 'employee.manage',
  EMPLOYEE_VIEW_SENSITIVE: 'employee.view_sensitive',

  // attendance & leave
  ATTENDANCE_VIEW: 'attendance.view',
  ATTENDANCE_MANAGE: 'attendance.manage',
  ATTENDANCE_SELF: 'attendance.self', // clock in/out for oneself
  LEAVE_VIEW: 'leave.view',
  LEAVE_MANAGE: 'leave.manage',
  LEAVE_REQUEST: 'leave.request',

  // payroll
  PAYROLL_VIEW: 'payroll.view',
  PAYROLL_MANAGE: 'payroll.manage',
  PAYSLIP_SELF: 'payslip.self', // view own payslips

  // inventory
  ITEM_VIEW: 'item.view',
  ITEM_MANAGE: 'item.manage',
  STOCK_VIEW: 'stock.view',
  STOCK_MANAGE: 'stock.manage', // adjustments, transfers, counts

  // purchasing
  SUPPLIER_VIEW: 'supplier.view',
  SUPPLIER_MANAGE: 'supplier.manage',
  PURCHASE_VIEW: 'purchase.view',
  PURCHASE_MANAGE: 'purchase.manage',

  // sales
  CUSTOMER_VIEW: 'customer.view',
  CUSTOMER_MANAGE: 'customer.manage',
  SALES_VIEW: 'sales.view',
  SALES_MANAGE: 'sales.manage',

  // expenses
  EXPENSE_VIEW: 'expense.view',
  EXPENSE_MANAGE: 'expense.manage',

  // production / work orders
  PRODUCTION_VIEW: 'production.view',
  PRODUCTION_MANAGE: 'production.manage',

  // fixed assets
  ASSET_VIEW: 'asset.view',
  ASSET_MANAGE: 'asset.manage',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const P = PERMISSIONS;
const ALL = Object.values(P) as PermissionCode[];

/** Default permission grants per role. The owner gets everything. */
export const ROLE_PERMISSIONS: Record<RoleCode, PermissionCode[]> = {
  [ROLES.OWNER]: ALL,
  [ROLES.ACCOUNTS]: [
    P.USER_VIEW,
    P.SETTINGS_VIEW,
    P.ACCOUNT_VIEW, P.ACCOUNT_MANAGE, P.JOURNAL_VIEW, P.JOURNAL_POST, P.REPORT_VIEW,
    P.EMPLOYEE_VIEW, P.EMPLOYEE_VIEW_SENSITIVE,
    P.ATTENDANCE_VIEW,
    P.PAYROLL_VIEW, P.PAYROLL_MANAGE,
    P.ITEM_VIEW, P.STOCK_VIEW,
    P.SUPPLIER_VIEW, P.SUPPLIER_MANAGE, P.PURCHASE_VIEW, P.PURCHASE_MANAGE,
    P.CUSTOMER_VIEW, P.CUSTOMER_MANAGE, P.SALES_VIEW, P.SALES_MANAGE,
    P.EXPENSE_VIEW, P.EXPENSE_MANAGE, P.ASSET_VIEW, P.ASSET_MANAGE,
    P.PRODUCTION_VIEW,
  ],
  [ROLES.STORE]: [
    P.SETTINGS_VIEW,
    P.ITEM_VIEW, P.ITEM_MANAGE, P.STOCK_VIEW, P.STOCK_MANAGE,
    P.SUPPLIER_VIEW, P.PURCHASE_VIEW, P.PURCHASE_MANAGE,
    P.PRODUCTION_VIEW, P.PRODUCTION_MANAGE,
  ],
  [ROLES.SUPERVISOR]: [
    P.SETTINGS_VIEW,
    P.EMPLOYEE_VIEW,
    P.ATTENDANCE_VIEW, P.ATTENDANCE_MANAGE,
    P.LEAVE_VIEW, P.LEAVE_MANAGE,
    P.ITEM_VIEW, P.STOCK_VIEW,
  ],
  [ROLES.EMPLOYEE]: [
    P.ATTENDANCE_SELF,
    P.LEAVE_REQUEST,
    P.PAYSLIP_SELF,
  ],
};

export const ROLE_DESCRIPTIONS: Record<RoleCode, string> = {
  [ROLES.OWNER]: 'Business owner — full access to everything',
  [ROLES.ACCOUNTS]: 'Office/accounts staff — invoices, purchases, payroll, ledger',
  [ROLES.STORE]: 'Stores in-charge — inventory and stock',
  [ROLES.SUPERVISOR]: 'Floor supervisor — attendance and team',
  [ROLES.EMPLOYEE]: 'Workshop employee — clock in/out, own payslips',
};
