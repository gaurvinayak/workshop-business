import { Injectable } from '@nestjs/common';
import {
  ACCOUNT_CODES,
  AppError,
  CreateItemInput,
  UpdateItemInput,
  StockAdjustmentInput,
  StockTransferInput,
  CreateStockCountInput,
  Money,
  PaginationQuery,
  paginate,
  toSkipTake,
} from '@workshopos/shared';
import { PrismaService } from '../prisma/prisma.service';
import { JournalService } from '../accounting/journal.service';
import { NumberingService } from '../common/numbering.service';
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
    private readonly numbering: NumberingService,
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

  /** Physical stock count: records counted vs system qty and posts variances. */
  async stockCount(input: CreateStockCountInput, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const number = await this.numbering.next(tx, 'SC', new Date(input.date).getUTCFullYear());
      let netValue = Money.zero(); // signed inventory value change
      const lineData: { itemId: string; countedQty: string; systemQty: string }[] = [];

      for (const line of input.lines) {
        const level = await tx.stockLevel.findUnique({ where: { itemId_locationId: { itemId: line.itemId, locationId: input.locationId } } });
        const systemQty = Money.of(level?.quantity?.toString() ?? '0');
        const counted = Money.of(line.countedQty);
        const variance = counted.subtract(systemQty);
        lineData.push({ itemId: line.itemId, countedQty: line.countedQty, systemQty: systemQty.toString() });
        if (variance.isZero()) continue;

        const res = await this.stock.applyMovement(tx, {
          itemId: line.itemId, locationId: input.locationId, quantity: variance.toString(),
          unitCost: level?.avgCost?.toString() ?? '0', type: 'ADJUSTMENT',
          refType: 'stock_count', refId: number, byUserId: userId, note: `Count ${number}`,
        });
        netValue = netValue.add(variance.isNegative() ? res.value.negate() : res.value);
      }

      const count = await tx.stockCount.create({
        data: { number, locationId: input.locationId, date: new Date(input.date), status: 'POSTED', lines: { create: lineData } },
      });

      if (!netValue.isZero()) {
        const inventory = await this.journal.accountIdByCode(tx, ACCOUNT_CODES.INVENTORY);
        const adjustment = await this.journal.accountIdByCode(tx, ACCOUNT_CODES.INVENTORY_ADJUSTMENT);
        const mag = netValue.isNegative() ? netValue.negate().toString() : netValue.toString();
        await this.journal.postWithinTransaction(tx, {
          date: input.date, narration: `Stock count ${number} variance`, sourceType: 'stock_count', sourceId: count.id, postedById: userId,
          lines: netValue.isNegative()
            ? [{ accountId: adjustment, debit: mag, credit: '0' }, { accountId: inventory, debit: '0', credit: mag }]
            : [{ accountId: inventory, debit: mag, credit: '0' }, { accountId: adjustment, debit: '0', credit: mag }],
        });
      }
      return count;
    });
  }

  listStockCounts() {
    return this.prisma.stockCount.findMany({ orderBy: { date: 'desc' }, include: { location: { select: { name: true } } } });
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
