import { z } from 'zod';
import { moneyString } from './schemas';

export const createCustomerSchema = z.object({
  name: z.string().min(1),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  billingAddress: z.string().optional(),
  taxId: z.string().optional(),
  creditTermsDays: z.coerce.number().int().min(0).default(0),
});
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

const invoiceLineSchema = z.object({
  itemId: z.string().uuid(),
  description: z.string().optional(),
  quantity: moneyString,
  rate: moneyString,
  discount: moneyString.default('0'),
  taxRate: moneyString.default('0'),
});

export const createInvoiceSchema = z.object({
  customerId: z.string().uuid(),
  date: z.string().date(),
  dueDate: z.string().date().optional(),
  lines: z.array(invoiceLineSchema).min(1),
});
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

export const paymentReceiptSchema = z.object({
  customerId: z.string().uuid(),
  date: z.string().date(),
  amount: moneyString,
  method: z.enum(['CASH', 'BANK']).default('BANK'),
  // optional allocations to specific invoices; otherwise oldest-first
  allocations: z.array(z.object({ invoiceId: z.string().uuid(), amount: moneyString })).optional(),
});
export type PaymentReceiptInput = z.infer<typeof paymentReceiptSchema>;
