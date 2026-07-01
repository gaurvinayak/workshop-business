import { z } from 'zod';
import { moneyString } from './schemas';

// ---- Quotations ----
const saleLine = z.object({
  itemId: z.string().uuid(),
  description: z.string().optional(),
  quantity: moneyString,
  rate: moneyString,
  discount: moneyString.default('0'),
  taxRate: moneyString.default('0'),
});

export const createQuotationSchema = z.object({
  customerId: z.string().uuid(),
  date: z.string().date(),
  validUntil: z.string().date().optional(),
  lines: z.array(saleLine).min(1),
});
export type CreateQuotationInput = z.infer<typeof createQuotationSchema>;

// ---- Credit note (sales return) ----
export const createCreditNoteSchema = z.object({
  customerId: z.string().uuid(),
  invoiceId: z.string().uuid().optional(),
  date: z.string().date(),
  locationId: z.string().uuid(),
  lines: z.array(z.object({ itemId: z.string().uuid(), quantity: moneyString, rate: moneyString, taxRate: moneyString.default('0') })).min(1),
});
export type CreateCreditNoteInput = z.infer<typeof createCreditNoteSchema>;

// ---- Debit note (purchase return) ----
export const createDebitNoteSchema = z.object({
  supplierId: z.string().uuid(),
  date: z.string().date(),
  locationId: z.string().uuid(),
  lines: z.array(z.object({ itemId: z.string().uuid(), quantity: moneyString, taxRate: moneyString.default('0') })).min(1),
});
export type CreateDebitNoteInput = z.infer<typeof createDebitNoteSchema>;

// ---- Stock count ----
export const createStockCountSchema = z.object({
  locationId: z.string().uuid(),
  date: z.string().date(),
  lines: z.array(z.object({ itemId: z.string().uuid(), countedQty: moneyString })).min(1),
});
export type CreateStockCountInput = z.infer<typeof createStockCountSchema>;

// ---- Employee advance / loan ----
export const createAdvanceSchema = z.object({
  employeeId: z.string().uuid(),
  date: z.string().date(),
  amount: moneyString,
  installment: moneyString,
  method: z.enum(['CASH', 'BANK']).default('BANK'),
  note: z.string().optional(),
});
export type CreateAdvanceInput = z.infer<typeof createAdvanceSchema>;

// ---- Expense (incl. recurring templates) ----
export const createExpenseSchema = z.object({
  date: z.string().date(),
  accountCode: z.string().min(1),
  description: z.string().min(1),
  amount: moneyString,
  taxAmount: moneyString.default('0'),
  method: z.enum(['CASH', 'BANK']).default('BANK'),
  supplierId: z.string().uuid().optional(),
  recurring: z.boolean().default(false),
});
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

// ---- Work order (production) ----
export const createWorkOrderSchema = z.object({
  description: z.string().min(1),
  locationId: z.string().uuid(),
  date: z.string().date(),
  laborCost: moneyString.default('0'),
  overheadCost: moneyString.default('0'),
  materials: z.array(z.object({ itemId: z.string().uuid(), quantity: moneyString })).min(1),
  outputs: z.array(z.object({ itemId: z.string().uuid(), quantity: moneyString })).min(1),
});
export type CreateWorkOrderInput = z.infer<typeof createWorkOrderSchema>;

// ---- Fixed assets ----
export const createFixedAssetSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  purchaseDate: z.string().date(),
  cost: moneyString,
  salvageValue: moneyString.default('0'),
  usefulLifeMonths: z.coerce.number().int().min(1),
});
export type CreateFixedAssetInput = z.infer<typeof createFixedAssetSchema>;

export const depreciationRunSchema = z.object({ period: z.string().regex(/^\d{4}-\d{2}$/, 'YYYY-MM') });
export type DepreciationRunInput = z.infer<typeof depreciationRunSchema>;
