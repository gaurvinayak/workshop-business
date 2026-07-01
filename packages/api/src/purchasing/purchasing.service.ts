import { Injectable } from '@nestjs/common';
import {
  ACCOUNT_CODES,
  AppError,
  CreateSupplierInput,
  CreatePurchaseOrderInput,
  GoodsReceiptInput,
  SupplierPaymentInput,
  CreateDebitNoteInput,
  Money,
  sumMoney,
  computeDocumentTotals,
} from '@workshopos/shared';
import { PrismaService } from '../prisma/prisma.service';
import { JournalService } from '../accounting/journal.service';
import { StockService } from '../inventory/stock.service';
import { NumberingService } from '../common/numbering.service';

@Injectable()
export class PurchasingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journal: JournalService,
    private readonly stock: StockService,
    private readonly numbering: NumberingService,
  ) {}

  // ---- Suppliers ----
  listSuppliers() {
    return this.prisma.supplier.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  }
  createSupplier(input: CreateSupplierInput) {
    return this.prisma.supplier.create({ data: { ...input, email: input.email || null } });
  }
  async getSupplier(id: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
      include: { bills: true, payments: true },
    });
    if (!supplier) throw AppError.notFound('Supplier');
    const billed = sumMoney(supplier.bills.map((b) => b.total.toString()));
    const paid = sumMoney(supplier.payments.map((p) => p.amount.toString()));
    return { ...supplier, balance: billed.subtract(paid).toString() };
  }

  // ---- Purchase orders ----
  async createPurchaseOrder(input: CreatePurchaseOrderInput) {
    const totals = computeDocumentTotals(input.lines.map((l) => ({ quantity: l.quantity, rate: l.rate, taxRate: l.taxRate })));
    return this.prisma.$transaction(async (tx) => {
      const number = await this.numbering.next(tx, 'PO', new Date(input.date).getUTCFullYear());
      return tx.purchaseOrder.create({
        data: {
          number,
          supplierId: input.supplierId,
          date: new Date(input.date),
          expectedDate: input.expectedDate ? new Date(input.expectedDate) : null,
          subtotal: totals.subtotal.toString(),
          taxTotal: totals.taxTotal.toString(),
          total: totals.total.toString(),
          status: 'DRAFT',
          lines: {
            create: input.lines.map((l) => ({
              itemId: l.itemId,
              quantity: l.quantity,
              rate: l.rate,
              taxRate: l.taxRate,
            })),
          },
        },
        include: { lines: true },
      });
    });
  }

  listPurchaseOrders() {
    return this.prisma.purchaseOrder.findMany({
      orderBy: { date: 'desc' },
      include: { supplier: { select: { name: true } } },
    });
  }
  async getPurchaseOrder(id: string) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: { supplier: true, lines: { include: { item: true } } },
    });
    if (!po) throw AppError.notFound('Purchase order');
    return po;
  }

  /**
   * Receive goods against a PO: increases stock (moving-average), raises a
   * supplier bill (payable), and posts the ledger — all atomically.
   */
  async receive(poId: string, input: GoodsReceiptInput, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findUnique({ where: { id: poId }, include: { lines: true } });
      if (!po) throw AppError.notFound('Purchase order');
      if (po.status === 'CANCELLED' || po.status === 'CLOSED') throw AppError.conflict('PO is closed');

      const year = new Date(input.date).getUTCFullYear();
      const grnNumber = await this.numbering.next(tx, 'GRN', year);

      let goodsValue = Money.zero();
      let taxValue = Money.zero();

      for (const rl of input.lines) {
        const poLine = po.lines.find((l) => l.id === rl.poLineId);
        if (!poLine) throw AppError.validation('Receipt line does not belong to this PO');
        const qty = Money.of(rl.quantity);
        if (qty.isZero() || qty.isNegative()) throw AppError.validation('Receipt quantity must be positive');

        await this.stock.applyMovement(tx, {
          itemId: poLine.itemId,
          locationId: input.locationId,
          quantity: rl.quantity,
          unitCost: rl.unitCost,
          type: 'PURCHASE',
          refType: 'goods_receipt',
          refId: poId,
          byUserId: userId,
        });

        const lineValue = qty.multiply(Money.of(rl.unitCost).toString()).round();
        goodsValue = goodsValue.add(lineValue);
        taxValue = taxValue.add(lineValue.percent(poLine.taxRate.toString()));

        await tx.purchaseOrderLine.update({
          where: { id: poLine.id },
          data: { receivedQty: { increment: rl.quantity } },
        });
      }

      const grn = await tx.goodsReceipt.create({
        data: {
          number: grnNumber,
          poId,
          locationId: input.locationId,
          date: new Date(input.date),
          lines: { create: input.lines.map((l) => ({ poLineId: l.poLineId, quantity: l.quantity, unitCost: l.unitCost })) },
        },
      });

      // Supplier bill (payable) for the received value.
      taxValue = taxValue.round();
      const total = goodsValue.add(taxValue);
      const billNumber = await this.numbering.next(tx, 'BILL', year);
      const bill = await tx.supplierBill.create({
        data: {
          number: billNumber,
          supplierId: po.supplierId,
          poId,
          date: new Date(input.date),
          subtotal: goodsValue.toString(),
          taxTotal: taxValue.toString(),
          total: total.toString(),
          status: 'UNPAID',
        },
      });

      // Ledger: Dr Inventory + Dr Input Tax, Cr Accounts Payable.
      const [inventory, inputTax, ap] = await Promise.all([
        this.journal.accountIdByCode(tx, ACCOUNT_CODES.INVENTORY),
        this.journal.accountIdByCode(tx, ACCOUNT_CODES.INPUT_TAX),
        this.journal.accountIdByCode(tx, ACCOUNT_CODES.ACCOUNTS_PAYABLE),
      ]);
      const lines = [
        { accountId: inventory, debit: goodsValue.toString(), credit: '0' },
        ...(taxValue.isZero() ? [] : [{ accountId: inputTax, debit: taxValue.toString(), credit: '0' }]),
        { accountId: ap, debit: '0', credit: total.toString(), partyType: 'supplier', partyId: po.supplierId },
      ];
      const entry = await this.journal.postWithinTransaction(tx, {
        date: input.date,
        narration: `Goods receipt ${grnNumber} against ${po.number}`,
        sourceType: 'supplier_bill',
        sourceId: bill.id,
        postedById: userId,
        lines,
      });
      await tx.supplierBill.update({ where: { id: bill.id }, data: { journalEntryId: entry.id } });

      // PO status.
      const refreshed = await tx.purchaseOrderLine.findMany({ where: { poId } });
      const fullyReceived = refreshed.every((l) => Money.of(l.receivedQty.toString()).compare(l.quantity.toString()) >= 0);
      await tx.purchaseOrder.update({
        where: { id: poId },
        data: { status: fullyReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED' },
      });

      return { goodsReceiptId: grn.id, billId: bill.id, total: total.toString() };
    });
  }

  listBills(filter: { supplierId?: string; status?: string }) {
    return this.prisma.supplierBill.findMany({
      where: { supplierId: filter.supplierId, status: filter.status as never },
      orderBy: { date: 'desc' },
      include: { supplier: { select: { name: true } } },
    });
  }

  /** Pay a supplier bill (full or partial); settles the payable. */
  async pay(input: SupplierPaymentInput, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const amount = Money.of(input.amount);
      if (amount.isZero() || amount.isNegative()) throw AppError.validation('Payment must be positive');

      let billId: string | undefined = input.billId;
      if (input.billId) {
        const bill = await tx.supplierBill.findUnique({ where: { id: input.billId } });
        if (!bill) throw AppError.notFound('Supplier bill');
        const newPaid = Money.of(bill.amountPaid.toString()).add(amount);
        const status = newPaid.compare(bill.total.toString()) >= 0 ? 'PAID' : 'PARTIAL';
        await tx.supplierBill.update({ where: { id: bill.id }, data: { amountPaid: newPaid.toString(), status } });
        billId = bill.id;
      }

      const number = await this.numbering.next(tx, 'PAY', new Date(input.date).getUTCFullYear());
      const payment = await tx.supplierPayment.create({
        data: { number, supplierId: input.supplierId, billId, date: new Date(input.date), amount: input.amount, method: input.method },
      });

      const [ap, cashOrBank] = await Promise.all([
        this.journal.accountIdByCode(tx, ACCOUNT_CODES.ACCOUNTS_PAYABLE),
        this.journal.accountIdByCode(tx, input.method === 'CASH' ? ACCOUNT_CODES.CASH : ACCOUNT_CODES.BANK),
      ]);
      const entry = await this.journal.postWithinTransaction(tx, {
        date: input.date,
        narration: `Payment ${number} to supplier`,
        sourceType: 'supplier_payment',
        sourceId: payment.id,
        postedById: userId,
        lines: [
          { accountId: ap, debit: input.amount, credit: '0', partyType: 'supplier', partyId: input.supplierId },
          { accountId: cashOrBank, debit: '0', credit: input.amount },
        ],
      });
      await tx.supplierPayment.update({ where: { id: payment.id }, data: { journalEntryId: entry.id } });
      return payment;
    });
  }

  // ---- Debit notes (purchase returns) ----
  async createDebitNote(input: CreateDebitNoteInput, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const number = await this.numbering.next(tx, 'DN', new Date(input.date).getUTCFullYear());
      let goodsValue = Money.zero();
      let taxValue = Money.zero();
      const lineData: { itemId: string; quantity: string; taxRate: string; lineTotal: string }[] = [];

      for (const line of input.lines) {
        // Return goods to the supplier: stock out at current average cost.
        const res = await this.stock.applyMovement(tx, {
          itemId: line.itemId, locationId: input.locationId,
          quantity: Money.of(line.quantity).negate().toString(),
          type: 'RETURN', refType: 'debit_note', refId: number, byUserId: userId,
        });
        const lineTax = res.value.percent(line.taxRate);
        goodsValue = goodsValue.add(res.value);
        taxValue = taxValue.add(lineTax);
        lineData.push({ itemId: line.itemId, quantity: line.quantity, taxRate: line.taxRate, lineTotal: res.value.add(lineTax).toString() });
      }

      taxValue = taxValue.round();
      const total = goodsValue.add(taxValue);
      const dn = await tx.debitNote.create({
        data: {
          number, supplierId: input.supplierId, date: new Date(input.date), locationId: input.locationId,
          subtotal: goodsValue.toString(), taxTotal: taxValue.toString(), total: total.toString(),
          lines: { create: lineData },
        },
      });

      const [ap, inventory, inputTax] = await Promise.all([
        this.journal.accountIdByCode(tx, ACCOUNT_CODES.ACCOUNTS_PAYABLE),
        this.journal.accountIdByCode(tx, ACCOUNT_CODES.INVENTORY),
        this.journal.accountIdByCode(tx, ACCOUNT_CODES.INPUT_TAX),
      ]);
      const lines = [
        { accountId: ap, debit: total.toString(), credit: '0', partyType: 'supplier', partyId: input.supplierId },
        { accountId: inventory, debit: '0', credit: goodsValue.toString() },
        ...(taxValue.isZero() ? [] : [{ accountId: inputTax, debit: '0', credit: taxValue.toString() }]),
      ];
      const entry = await this.journal.postWithinTransaction(tx, {
        date: input.date, narration: `Debit note ${number}`, sourceType: 'debit_note', sourceId: dn.id, postedById: userId, lines,
      });
      await tx.debitNote.update({ where: { id: dn.id }, data: { journalEntryId: entry.id } });
      return dn;
    });
  }

  listDebitNotes() {
    return this.prisma.debitNote.findMany({ orderBy: { date: 'desc' }, include: { supplier: { select: { name: true } } } });
  }
}
