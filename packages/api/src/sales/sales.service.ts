import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ACCOUNT_CODES,
  AppError,
  CreateCustomerInput,
  CreateInvoiceInput,
  PaymentReceiptInput,
  Money,
  sumMoney,
  computeDocumentTotals,
} from '@workshopos/shared';
import { PrismaService } from '../prisma/prisma.service';
import { JournalService } from '../accounting/journal.service';
import { StockService } from '../inventory/stock.service';
import { NumberingService } from '../common/numbering.service';

type Tx = Prisma.TransactionClient;

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journal: JournalService,
    private readonly stock: StockService,
    private readonly numbering: NumberingService,
  ) {}

  // ---- Customers ----
  listCustomers() {
    return this.prisma.customer.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  }
  createCustomer(input: CreateCustomerInput) {
    return this.prisma.customer.create({ data: { ...input, email: input.email || null } });
  }
  async getCustomer(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: { invoices: { where: { status: { not: 'VOID' } } }, receipts: true },
    });
    if (!customer) throw AppError.notFound('Customer');
    const invoiced = sumMoney(customer.invoices.filter((i) => i.status !== 'DRAFT').map((i) => i.total.toString()));
    const received = sumMoney(customer.receipts.map((r) => r.amount.toString()));
    return { ...customer, balance: invoiced.subtract(received).toString() };
  }

  // ---- Invoices ----
  async createInvoice(input: CreateInvoiceInput) {
    const totals = computeDocumentTotals(
      input.lines.map((l) => ({ quantity: l.quantity, rate: l.rate, discount: l.discount, taxRate: l.taxRate })),
    );
    return this.prisma.invoice.create({
      data: {
        customerId: input.customerId,
        date: new Date(input.date),
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        status: 'DRAFT',
        subtotal: totals.subtotal.toString(),
        taxTotal: totals.taxTotal.toString(),
        total: totals.total.toString(),
        lines: {
          create: input.lines.map((l, i) => ({
            itemId: l.itemId,
            description: l.description,
            quantity: l.quantity,
            rate: l.rate,
            discount: l.discount,
            taxRate: l.taxRate,
            lineTotal: totals.lines[i].total.toString(),
          })),
        },
      },
      include: { lines: true },
    });
  }

  listInvoices(filter: { customerId?: string; status?: string }) {
    return this.prisma.invoice.findMany({
      where: { customerId: filter.customerId, status: filter.status as never },
      orderBy: { date: 'desc' },
      include: { customer: { select: { name: true } } },
    });
  }
  async getInvoice(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: { customer: true, lines: { include: { item: true } } },
    });
    if (!invoice) throw AppError.notFound('Invoice');
    return invoice;
  }

  /**
   * Post a draft invoice: assign a gap-free number, move stock out at moving-
   * average cost (COGS), and write the balanced journal entry — atomically and
   * idempotently (re-posting a posted invoice is a no-op).
   */
  async postInvoice(id: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({ where: { id }, include: { lines: { include: { item: true } } } });
      if (!invoice) throw AppError.notFound('Invoice');
      if (invoice.status !== 'DRAFT') return invoice; // idempotent

      const dateStr = invoice.date.toISOString().slice(0, 10);
      const number = await this.numbering.next(tx, 'INV', invoice.date.getUTCFullYear());

      // Stock-out for tracked items -> COGS value.
      let stockValue = Money.zero();
      for (const line of invoice.lines) {
        if (!line.item.isStockTracked) continue;
        const res = await this.stock.applyMovement(tx, {
          itemId: line.itemId,
          locationId: await this.defaultLocationId(tx),
          quantity: Money.of(line.quantity.toString()).negate().toString(),
          type: 'SALE',
          refType: 'invoice',
          refId: invoice.id,
          byUserId: userId,
          allowNegative: true,
        });
        stockValue = stockValue.add(res.value);
      }

      const subtotal = Money.of(invoice.subtotal.toString());
      const taxTotal = Money.of(invoice.taxTotal.toString());
      const total = Money.of(invoice.total.toString());

      const [ar, sales, outputTax, cogs, inventory] = await Promise.all([
        this.journal.accountIdByCode(tx, ACCOUNT_CODES.ACCOUNTS_RECEIVABLE),
        this.journal.accountIdByCode(tx, ACCOUNT_CODES.SALES),
        this.journal.accountIdByCode(tx, ACCOUNT_CODES.OUTPUT_TAX),
        this.journal.accountIdByCode(tx, ACCOUNT_CODES.COGS),
        this.journal.accountIdByCode(tx, ACCOUNT_CODES.INVENTORY),
      ]);

      const lines = [
        { accountId: ar, debit: total.toString(), credit: '0', partyType: 'customer', partyId: invoice.customerId },
        { accountId: sales, debit: '0', credit: subtotal.toString() },
        ...(taxTotal.isZero() ? [] : [{ accountId: outputTax, debit: '0', credit: taxTotal.toString() }]),
        ...(stockValue.isZero()
          ? []
          : [
              { accountId: cogs, debit: stockValue.toString(), credit: '0' },
              { accountId: inventory, debit: '0', credit: stockValue.toString() },
            ]),
      ];

      const entry = await this.journal.postWithinTransaction(tx, {
        date: dateStr,
        narration: `Invoice ${number}`,
        sourceType: 'invoice',
        sourceId: invoice.id,
        postedById: userId,
        lines,
      });

      return tx.invoice.update({
        where: { id },
        data: { status: 'POSTED', number, journalEntryId: entry.id },
        include: { lines: true },
      });
    });
  }

  private async defaultLocationId(tx: Tx): Promise<string> {
    const loc = await tx.location.findFirst({ where: { isActive: true }, orderBy: { name: 'asc' } });
    if (!loc) throw AppError.validation('No stock location configured');
    return loc.id;
  }

  // ---- Payments ----
  async receivePayment(input: PaymentReceiptInput, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const amount = Money.of(input.amount);
      if (amount.isZero() || amount.isNegative()) throw AppError.validation('Payment must be positive');

      // Determine allocations.
      let allocations = input.allocations ?? [];
      if (allocations.length === 0) {
        const open = await tx.invoice.findMany({
          where: { customerId: input.customerId, status: { in: ['POSTED', 'PARTIALLY_PAID'] } },
          orderBy: { date: 'asc' },
        });
        let remaining = amount;
        for (const inv of open) {
          if (remaining.isZero() || remaining.isNegative()) break;
          const due = Money.of(inv.total.toString()).subtract(inv.amountPaid.toString());
          const alloc = remaining.compare(due) >= 0 ? due : remaining;
          if (alloc.isZero() || alloc.isNegative()) continue;
          allocations.push({ invoiceId: inv.id, amount: alloc.toString() });
          remaining = remaining.subtract(alloc);
        }
      }

      const number = await this.numbering.next(tx, 'RCPT', new Date(input.date).getUTCFullYear());
      const receipt = await tx.paymentReceipt.create({
        data: {
          number,
          customerId: input.customerId,
          date: new Date(input.date),
          amount: input.amount,
          method: input.method,
          allocations: { create: allocations.map((a) => ({ invoiceId: a.invoiceId, amount: a.amount })) },
        },
      });

      for (const a of allocations) {
        const inv = await tx.invoice.findUnique({ where: { id: a.invoiceId } });
        if (!inv) continue;
        const newPaid = Money.of(inv.amountPaid.toString()).add(a.amount);
        const status = newPaid.compare(inv.total.toString()) >= 0 ? 'PAID' : 'PARTIALLY_PAID';
        await tx.invoice.update({ where: { id: inv.id }, data: { amountPaid: newPaid.toString(), status } });
      }

      const [bankOrCash, ar] = await Promise.all([
        this.journal.accountIdByCode(tx, input.method === 'CASH' ? ACCOUNT_CODES.CASH : ACCOUNT_CODES.BANK),
        this.journal.accountIdByCode(tx, ACCOUNT_CODES.ACCOUNTS_RECEIVABLE),
      ]);
      const entry = await this.journal.postWithinTransaction(tx, {
        date: input.date,
        narration: `Receipt ${number}`,
        sourceType: 'payment_receipt',
        sourceId: receipt.id,
        postedById: userId,
        lines: [
          { accountId: bankOrCash, debit: input.amount, credit: '0' },
          { accountId: ar, debit: '0', credit: input.amount, partyType: 'customer', partyId: input.customerId },
        ],
      });
      await tx.paymentReceipt.update({ where: { id: receipt.id }, data: { journalEntryId: entry.id } });
      return receipt;
    });
  }
}
