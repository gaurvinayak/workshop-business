import { Injectable } from '@nestjs/common';
import { ACCOUNT_CODES, Money, sumMoney } from '@workshopos/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary() {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const todayStr = now.toISOString().slice(0, 10);
    const today = new Date(todayStr);

    const [cashBank, monthInvoices, monthBills, openInvoices, openBills, todayPresent, levels] = await Promise.all([
      this.cashAndBank(),
      this.prisma.invoice.findMany({ where: { date: { gte: monthStart }, status: { not: 'DRAFT' } }, select: { total: true } }),
      this.prisma.supplierBill.findMany({ where: { date: { gte: monthStart } }, select: { total: true } }),
      this.prisma.invoice.findMany({ where: { status: { in: ['POSTED', 'PARTIALLY_PAID'] } }, select: { total: true, amountPaid: true } }),
      this.prisma.supplierBill.findMany({ where: { status: { in: ['UNPAID', 'PARTIAL'] } }, select: { total: true, amountPaid: true } }),
      this.prisma.attendance.count({ where: { date: today, status: { in: ['PRESENT', 'HALF_DAY'] } } }),
      this.prisma.stockLevel.findMany({ include: { item: { select: { reorderLevel: true } } } }),
    ]);

    const receivables = openInvoices.reduce((acc, i) => acc.add(Money.of(i.total.toString()).subtract(i.amountPaid.toString())), Money.zero());
    const payables = openBills.reduce((acc, b) => acc.add(Money.of(b.total.toString()).subtract(b.amountPaid.toString())), Money.zero());
    const lowStock = levels.filter((l) => Money.of(l.quantity.toString()).compare(l.item.reorderLevel.toString()) <= 0).length;

    return {
      cashAndBank: cashBank.toString(),
      monthSales: sumMoney(monthInvoices.map((i) => i.total.toString())).toString(),
      monthPurchases: sumMoney(monthBills.map((b) => b.total.toString())).toString(),
      receivables: receivables.toString(),
      payables: payables.toString(),
      presentToday: todayPresent,
      lowStockItems: lowStock,
    };
  }

  private async cashAndBank(): Promise<Money> {
    const accounts = await this.prisma.account.findMany({
      where: { code: { in: [ACCOUNT_CODES.CASH, ACCOUNT_CODES.BANK] } },
      select: { id: true },
    });
    const ids = accounts.map((a) => a.id);
    if (ids.length === 0) return Money.zero();
    const grouped = await this.prisma.journalLine.groupBy({
      by: ['accountId'],
      _sum: { debit: true, credit: true },
      where: { accountId: { in: ids } },
    });
    return grouped.reduce(
      (acc, g) => acc.add(Money.of(g._sum.debit?.toString() ?? '0').subtract(g._sum.credit?.toString() ?? '0')),
      Money.zero(),
    );
  }
}
