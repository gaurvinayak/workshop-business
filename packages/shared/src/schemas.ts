import { z } from 'zod';

/** Reusable money string: decimal with up to 4 dp. */
export const moneyString = z
  .string()
  .regex(/^-?\d+(\.\d{1,4})?$/, 'Must be a number with up to 4 decimal places');

// ---- Auth ----
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

// ---- First-run setup wizard ----
export const setupSchema = z.object({
  business: z.object({
    name: z.string().min(2),
    currency: z.string().length(3, 'ISO 4217 code, e.g. INR'),
    timezone: z.string().min(1, 'IANA timezone, e.g. Asia/Kolkata'),
    taxId: z.string().optional(),
  }),
  fiscalYear: z.object({
    name: z.string().min(1),
    startDate: z.string().date(),
    endDate: z.string().date(),
  }),
  owner: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(10, 'Use at least 10 characters'),
  }),
});
export type SetupInput = z.infer<typeof setupSchema>;

// ---- Accounting ----
export const accountTypeEnum = z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE']);
export type AccountType = z.infer<typeof accountTypeEnum>;

export const createAccountSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(2),
  type: accountTypeEnum,
  parentId: z.string().uuid().nullable().optional(),
  isPostable: z.boolean().default(true),
});
export type CreateAccountInput = z.infer<typeof createAccountSchema>;

export const journalLineSchema = z
  .object({
    accountId: z.string().uuid(),
    debit: moneyString.default('0'),
    credit: moneyString.default('0'),
    description: z.string().optional(),
  })
  .refine(
    (l) => !(Number(l.debit) > 0 && Number(l.credit) > 0),
    'A line cannot have both a debit and a credit',
  );

export const createJournalEntrySchema = z.object({
  date: z.string().date(),
  narration: z.string().min(1),
  lines: z.array(journalLineSchema).min(2, 'A journal entry needs at least two lines'),
});
export type CreateJournalEntryInput = z.infer<typeof createJournalEntrySchema>;
