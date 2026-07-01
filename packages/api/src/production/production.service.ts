import { Injectable } from '@nestjs/common';
import { ACCOUNT_CODES, AppError, CreateWorkOrderInput, Money } from '@workshopos/shared';
import { PrismaService } from '../prisma/prisma.service';
import { JournalService } from '../accounting/journal.service';
import { NumberingService } from '../common/numbering.service';
import { StockService } from '../inventory/stock.service';

@Injectable()
export class ProductionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journal: JournalService,
    private readonly numbering: NumberingService,
    private readonly stock: StockService,
  ) {}

  list() {
    return this.prisma.workOrder.findMany({ orderBy: { date: 'desc' }, include: { location: { select: { name: true } } } });
  }

  async get(id: string) {
    const wo = await this.prisma.workOrder.findUnique({
      where: { id },
      include: { location: true, materials: { include: { item: true } }, outputs: { include: { item: true } } },
    });
    if (!wo) throw AppError.notFound('Work order');
    return wo;
  }

  async create(input: CreateWorkOrderInput) {
    return this.prisma.$transaction(async (tx) => {
      const number = await this.numbering.next(tx, 'WO', new Date(input.date).getUTCFullYear());
      return tx.workOrder.create({
        data: {
          number, description: input.description, locationId: input.locationId, date: new Date(input.date),
          laborCost: input.laborCost, overheadCost: input.overheadCost, status: 'DRAFT',
          materials: { create: input.materials.map((m) => ({ itemId: m.itemId, quantity: m.quantity })) },
          outputs: { create: input.outputs.map((o) => ({ itemId: o.itemId, quantity: o.quantity })) },
        },
        include: { materials: true, outputs: true },
      });
    });
  }

  /**
   * Complete a work order: consume raw materials (stock out at cost), add labor
   * and overhead, and produce finished goods valued at the full production cost.
   */
  async complete(id: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const wo = await tx.workOrder.findUnique({ where: { id }, include: { materials: true, outputs: true } });
      if (!wo) throw AppError.notFound('Work order');
      if (wo.status === 'COMPLETED') throw AppError.conflict('Work order already completed');

      const dateStr = wo.date.toISOString().slice(0, 10);

      // Consume materials.
      let materialCost = Money.zero();
      for (const m of wo.materials) {
        const res = await this.stock.applyMovement(tx, {
          itemId: m.itemId, locationId: wo.locationId, quantity: Money.of(m.quantity.toString()).negate().toString(),
          type: 'PRODUCTION', refType: 'work_order', refId: wo.number, byUserId: userId,
        });
        materialCost = materialCost.add(res.value);
        await tx.workOrderMaterial.update({ where: { id: m.id }, data: { consumedValue: res.value.toString() } });
      }

      const labor = Money.of(wo.laborCost.toString());
      const overhead = Money.of(wo.overheadCost.toString());
      const totalCost = materialCost.add(labor).add(overhead);

      const totalOutputQty = wo.outputs.reduce((acc, o) => acc.add(Money.of(o.quantity.toString())), Money.zero());
      if (totalOutputQty.isZero()) throw AppError.validation('Work order has no output quantity');
      const unitCost = Money.of((totalCost.toNumber() / totalOutputQty.toNumber()).toFixed(4));

      // Produce outputs at the blended production cost.
      let outputValue = Money.zero();
      for (const o of wo.outputs) {
        const res = await this.stock.applyMovement(tx, {
          itemId: o.itemId, locationId: wo.locationId, quantity: o.quantity.toString(), unitCost: unitCost.toString(),
          type: 'PRODUCTION', refType: 'work_order', refId: wo.number, byUserId: userId,
        });
        outputValue = outputValue.add(res.value);
        await tx.workOrderOutput.update({ where: { id: o.id }, data: { unitCost: unitCost.toString() } });
      }

      // Capitalize labor + overhead into inventory (funded from bank).
      const addedValue = labor.add(overhead);
      if (!addedValue.isZero()) {
        const [inventory, bank] = await Promise.all([
          this.journal.accountIdByCode(tx, ACCOUNT_CODES.INVENTORY),
          this.journal.accountIdByCode(tx, ACCOUNT_CODES.BANK),
        ]);
        await this.journal.postWithinTransaction(tx, {
          date: dateStr, narration: `Work order ${wo.number} labor & overhead`, sourceType: 'work_order', sourceId: wo.id, postedById: userId,
          lines: [
            { accountId: inventory, debit: addedValue.toString(), credit: '0' },
            { accountId: bank, debit: '0', credit: addedValue.toString() },
          ],
        });
      }

      return tx.workOrder.update({
        where: { id },
        data: { status: 'COMPLETED', materialCost: materialCost.toString(), outputValue: outputValue.toString() },
        include: { materials: { include: { item: true } }, outputs: { include: { item: true } } },
      });
    });
  }
}
