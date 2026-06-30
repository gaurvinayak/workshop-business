import { z } from 'zod';
import { moneyString } from './schemas';

export const createSupplierSchema = z.object({
  name: z.string().min(1),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  taxId: z.string().optional(),
  paymentTermsDays: z.coerce.number().int().min(0).default(0),
});
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;

const lineSchema = z.object({
  itemId: z.string().uuid(),
  quantity: moneyString,
  rate: moneyString,
  taxRate: moneyString.default('0'),
});

export const createPurchaseOrderSchema = z.object({
  supplierId: z.string().uuid(),
  date: z.string().date(),
  expectedDate: z.string().date().optional(),
  lines: z.array(lineSchema).min(1),
});
export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;

/** Receive goods against a PO into a location. */
export const goodsReceiptSchema = z.object({
  locationId: z.string().uuid(),
  date: z.string().date(),
  lines: z
    .array(z.object({ poLineId: z.string().uuid(), quantity: moneyString, unitCost: moneyString }))
    .min(1),
});
export type GoodsReceiptInput = z.infer<typeof goodsReceiptSchema>;

export const supplierPaymentSchema = z.object({
  supplierId: z.string().uuid(),
  billId: z.string().uuid().optional(),
  date: z.string().date(),
  amount: moneyString,
  method: z.enum(['CASH', 'BANK']).default('BANK'),
});
export type SupplierPaymentInput = z.infer<typeof supplierPaymentSchema>;
