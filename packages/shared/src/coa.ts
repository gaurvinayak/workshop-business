import type { AccountType } from './schemas';

/**
 * Default chart of accounts seeded on first run. The owner can extend it.
 * `system` accounts are referenced by automated postings (sales, COGS,
 * payroll, tax) and must exist; they cannot be deleted from the UI.
 */
export interface SeedAccount {
  code: string;
  name: string;
  type: AccountType;
  parentCode: string | null;
  isPostable: boolean;
  system?: boolean;
}

/**
 * Stable codes for the system accounts that automated postings target.
 * Modules resolve the account id by these codes at posting time.
 */
export const ACCOUNT_CODES = {
  CASH: '1010',
  BANK: '1020',
  ACCOUNTS_RECEIVABLE: '1100',
  INVENTORY: '1200',
  INPUT_TAX: '1210',
  EMPLOYEE_ADVANCES: '1300',
  FIXED_ASSETS: '1500',
  ACCUMULATED_DEPRECIATION: '1900',
  ACCOUNTS_PAYABLE: '2100',
  OUTPUT_TAX: '2200',
  SALARY_PAYABLE: '2300',
  STATUTORY_PAYABLE: '2310',
  OWNERS_CAPITAL: '3100',
  RETAINED_EARNINGS: '3900',
  SALES: '4100',
  COGS: '5100',
  SALARY_EXPENSE: '5200',
  INVENTORY_ADJUSTMENT: '5300',
  DEPRECIATION_EXPENSE: '5500',
  GENERAL_EXPENSE: '5900',
} as const;

export const DEFAULT_CHART_OF_ACCOUNTS: SeedAccount[] = [
  // Assets
  { code: '1000', name: 'Assets', type: 'ASSET', parentCode: null, isPostable: false },
  { code: '1010', name: 'Cash', type: 'ASSET', parentCode: '1000', isPostable: true, system: true },
  { code: '1020', name: 'Bank', type: 'ASSET', parentCode: '1000', isPostable: true, system: true },
  { code: '1100', name: 'Accounts Receivable', type: 'ASSET', parentCode: '1000', isPostable: true, system: true },
  { code: '1200', name: 'Inventory', type: 'ASSET', parentCode: '1000', isPostable: true, system: true },
  { code: '1210', name: 'Input Tax', type: 'ASSET', parentCode: '1000', isPostable: true, system: true },
  { code: '1300', name: 'Employee Advances', type: 'ASSET', parentCode: '1000', isPostable: true, system: true },
  { code: '1500', name: 'Fixed Assets', type: 'ASSET', parentCode: '1000', isPostable: true, system: true },
  { code: '1900', name: 'Accumulated Depreciation', type: 'ASSET', parentCode: '1000', isPostable: true, system: true },

  // Liabilities
  { code: '2000', name: 'Liabilities', type: 'LIABILITY', parentCode: null, isPostable: false },
  { code: '2100', name: 'Accounts Payable', type: 'LIABILITY', parentCode: '2000', isPostable: true, system: true },
  { code: '2200', name: 'Output Tax Payable', type: 'LIABILITY', parentCode: '2000', isPostable: true, system: true },
  { code: '2300', name: 'Salary Payable', type: 'LIABILITY', parentCode: '2000', isPostable: true, system: true },
  { code: '2310', name: 'Statutory Payable', type: 'LIABILITY', parentCode: '2000', isPostable: true, system: true },

  // Equity
  { code: '3000', name: 'Equity', type: 'EQUITY', parentCode: null, isPostable: false },
  { code: '3100', name: "Owner's Capital", type: 'EQUITY', parentCode: '3000', isPostable: true, system: true },
  { code: '3900', name: 'Retained Earnings', type: 'EQUITY', parentCode: '3000', isPostable: true, system: true },

  // Income
  { code: '4000', name: 'Income', type: 'INCOME', parentCode: null, isPostable: false },
  { code: '4100', name: 'Sales', type: 'INCOME', parentCode: '4000', isPostable: true, system: true },
  { code: '4900', name: 'Other Income', type: 'INCOME', parentCode: '4000', isPostable: true },

  // Expenses
  { code: '5000', name: 'Expenses', type: 'EXPENSE', parentCode: null, isPostable: false },
  { code: '5100', name: 'Cost of Goods Sold', type: 'EXPENSE', parentCode: '5000', isPostable: true, system: true },
  { code: '5200', name: 'Salary Expense', type: 'EXPENSE', parentCode: '5000', isPostable: true, system: true },
  { code: '5300', name: 'Inventory Adjustment', type: 'EXPENSE', parentCode: '5000', isPostable: true, system: true },
  { code: '5500', name: 'Depreciation Expense', type: 'EXPENSE', parentCode: '5000', isPostable: true, system: true },
  { code: '5900', name: 'General Expense', type: 'EXPENSE', parentCode: '5000', isPostable: true, system: true },
];
