import { z } from 'zod';
import { moneyString } from './schemas';

export const componentTypeEnum = z.enum(['EARNING', 'DEDUCTION']);
export type ComponentType = z.infer<typeof componentTypeEnum>;

export const calcMethodEnum = z.enum(['FIXED', 'PERCENT_OF_BASIC']);
export type CalcMethod = z.infer<typeof calcMethodEnum>;

export const createSalaryComponentSchema = z.object({
  name: z.string().min(1),
  type: componentTypeEnum,
  calc: calcMethodEnum.default('FIXED'),
  taxable: z.boolean().default(true),
});
export type CreateSalaryComponentInput = z.infer<typeof createSalaryComponentSchema>;

export const setSalaryStructureSchema = z.object({
  employeeId: z.string().uuid(),
  effectiveFrom: z.string().date(),
  lines: z
    .array(z.object({ componentId: z.string().uuid(), amountOrRate: moneyString }))
    .min(1),
});
export type SetSalaryStructureInput = z.infer<typeof setSalaryStructureSchema>;

/** Create a payroll run for a month, e.g. "2026-06". */
export const createPayrollRunSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/, 'YYYY-MM'),
});
export type CreatePayrollRunInput = z.infer<typeof createPayrollRunSchema>;
