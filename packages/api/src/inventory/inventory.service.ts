import { Injectable } from '@nestjs/common';
import {
  ACCOUNT_CODES,
  AppError,
  CreateItemInput,
  UpdateItemInput,
  StockAdjustmentInput,
  StockTransferInput,
  Money,
  PaginationQuery,
  paginate,
  toSkipTake,
} from '@workshopos/shared';
import { PrismaService } from '../prisma/prisma.service';
import { JournalService } from '../accounting/journal.service';
import { StockService } from './stock.service';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
    private readonly journal: JournalService,
  ) {}

  // ---- Reference data ----
  listUoms() {
    return this.prisma.uom.findMany({ orderBy: { name: 'asc' } });
  }
  createUom(input: { name: string; symbol: string }) {
    return this.prisma.uom.create({ data: input });
  }
  listCategories() {
    return this.prisma.itemCategory.findMany({ orderBy: { name: 'asc' } });
  }
  createCategory(input: { name: string; parentId?: string | null }) {
    return this.prisma.itemCategory.create({ data: { name: input.name, parentId: input.parentId ?? null } });
  }
  listLocations() {
    return this.prisma.location.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  }
  createLocation(input: { name: string; type?: 'STORE' | 'WORKSHOP' | 'SCRAP' }) {
    return this.prisma.location.create({ data: { name: input.name, type: input.type ?? 'STORE' } });
  }

  // ---- Items ----
  async listItems(q: PaginationQuery, filter: { type?: string; search?: string }) {
    const { skip, take } = toSkipTake(q);
    const where: Record<string, unknown> = { isActive: true };
    if (filter.type) where.type = filter.type;
    if (filter.search) where.OR = [{ name: { contains: filter.search, mode: 'insensitive' } }, { sku: { contains: filter.search, mode: 'insensitive' } }];
    const [rows, total] = await Promise.all([
      this.prisma.item.findMany({ where, skip, take, orderBy: { name: 'asc' }, include: { uom: true, category: true } }),
      this.prisma.item.count({ where }),
    ]);
    return paginate(rows, total, q);
  }

  async getItem(id: string) {
    const item = await this.prisma.item.findUnique({
      where: { id },
      include: { uom: true, category: true, levels: { include: { location: true } } },
    });
    if (!item) throw AppError.notFound('Item');
    return item;
  }

  async createItem(input: CreateItemInput) {
    const existing = await this.prisma.item.findUnique({ where: { sku: input.sku } });
    if (existing) throw AppError.conflict(`SKU ${input.sku} already exists`);
    return this.prisma.item.create({
      data: {
        sku: input.sku,
        name: input.name,
        type: input.type,
        uomId: input.uomId,
        categoryId: input.categoryId ?? null,
        hsnCode: input.hsnCode,
        taxRate: input.taxRate,
        salePrice: input.salePrice,
        reorderLevel: input.reorderLevel,
        isStockTracked: input.type === 'SERVICE' ? false : input.isStockTracked,
      },
    });
  }

  async updateItem(id: string, input: UpdateItemInput) {
    await this.getItem(id);
    return this.prisma.item.update({
      where: { id },
      data: {
        name: input.name,
        type: input.type,
        uomId: input.uomId,
        categoryId: input.categoryId,
        hsnCode: input.hsnCode,
        taxRate: input.taxRate,
        salePrice: input.salePrice,
        reorderLevel: input.reorderLevel,
        isStockTracked: input.isStockTracked,
      },
    });
  }

  // ---- Stock views ----
  async stockLevels(filter: { locationId?: string; lowStock?: boolean }) {
    const levels = await this.prisma.stockLevel.findMany({
      where: { locationId: filter.locationId },
      include: { item: true, location: true },
      orderBy: { item: { name: 'asc' } },
    });
    const rows = levels.map((l) => ({
      itemId: l.itemId,
      sku: l.item.sku,
      name: l.item.name,
      location: l.location.name,
      quantity: l.quantity.toString(),
      avgCost: l.avgCost.toString(),
      reorderLevel: l.item.reorderLevel.toString(),
      low: Money.of(l.quantity.toString()).compare(l.item.reorderLevel.toString()) <= 0,
    }));
    return filter.lowStock ? rows.filter((r) => r.low) : rows;
  }

  itemMovements(itemId: string) {
    return this.prisma.stockMovement.findMany({
      where: { itemId },
      orderBy: { at: 'desc' },
      include: { location: true },
      take: 200,
    });
  }

  // ---- Stock operations ----
  async adjust(input: StockAdjustmentInput, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const result = await this.stock.applyMovement(tx, {
        itemId: input.itemId,
        locationId: input.locationId,
        quantity: input.quantity,
        unitCost: input.unitCost,
        type: 'ADJUSTMENT',
        note: input.reason,
        byUserId: userId,
        allowNegative: false,
      });

      // Post the value change: inbound increases inventory, outbound decreases.
      const inventory = await this.journal.accountIdByCode(tx, ACCOUNT_CODES.INVENTORY);
      const adjustment = await this.journal.accountIdByCode(tx, ACCOUNT_CODES.INVENTORY_ADJUSTMENT);
      const inbound = !Money.of(input.quantity).isNegative();
      const value = result.value.toString();
      if (!result.value.isZero()) {
        await this.journal.postWithinTransaction(tx, {
          date: today(),
          narration: `Stock adjustment: ${input.reason}`,
          sourceType: 'stock_adjustment',
          sourceId: result.movementId,
          postedById: userId,
          lines: inbound
            ? [
                { accountId: inventory, debit: value, credit: '0' },
                { accountId: adjustment, debit: '0', credit: value },
              ]
            : [
                { accountId: adjustment, debit: value, credit: '0' },
                { accountId: inventory, debit: '0', credit: value },
              ],
        });
      }
      return result;
    });
  }

  async transfer(input: StockTransferInput, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const out = await this.stock.applyMovement(tx, {
        itemId: input.itemId,
        locationId: input.fromLocationId,
        quantity: Money.of(input.quantity).negate().toString(),
        type: 'TRANSFER',
        note: `Transfer out`,
        byUserId: userId,
      });
      // Bring it in at the same cost so total inventory value is unchanged.
      await this.stock.applyMovement(tx, {
        itemId: input.itemId,
        locationId: input.toLocationId,
        quantity: input.quantity,
        unitCost: out.unitCost.toString(),
        type: 'TRANSFER',
        note: `Transfer in`,
        byUserId: userId,
      });
      return { ok: true };
    });
  }
}
