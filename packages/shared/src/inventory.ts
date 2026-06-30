import { z } from 'zod';
import { moneyString } from './schemas';

export const itemTypeEnum = z.enum(['PRODUCT', 'RAW_MATERIAL', 'SPARE_PART', 'SERVICE']);
export type ItemType = z.infer<typeof itemTypeEnum>;

export const createUomSchema = z.object({ name: z.string().min(1), symbol: z.string().min(1) });
export const createItemCategorySchema = z.object({
  name: z.string().min(1),
  parentId: z.string().uuid().optional().nullable(),
});
export const createLocationSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['STORE', 'WORKSHOP', 'SCRAP']).default('STORE'),
});

export const createItemSchema = z.object({
  sku: z.string().min(1).max(40),
  name: z.string().min(1),
  type: itemTypeEnum,
  uomId: z.string().uuid(),
  categoryId: z.string().uuid().optional().nullable(),
  hsnCode: z.string().optional(),
  taxRate: moneyString.default('0'),
  salePrice: moneyString.default('0'),
  reorderLevel: moneyString.default('0'),
  // Services aren't stock-tracked.
  isStockTracked: z.boolean().default(true),
});
export type CreateItemInput = z.infer<typeof createItemSchema>;

export const updateItemSchema = createItemSchema.partial();
export type UpdateItemInput = z.infer<typeof updateItemSchema>;

/** A manual stock adjustment (count variance, damage, opening stock). */
export const stockAdjustmentSchema = z.object({
  itemId: z.string().uuid(),
  locationId: z.string().uuid(),
  // signed: positive adds stock, negative removes it
  quantity: moneyString,
  unitCost: moneyString.default('0'),
  reason: z.string().min(3),
});
export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;

export const stockTransferSchema = z
  .object({
    itemId: z.string().uuid(),
    fromLocationId: z.string().uuid(),
    toLocationId: z.string().uuid(),
    quantity: moneyString,
  })
  .refine((v) => v.fromLocationId !== v.toLocationId, {
    message: 'Source and destination must differ',
    path: ['toLocationId'],
  });
export type StockTransferInput = z.infer<typeof stockTransferSchema>;
