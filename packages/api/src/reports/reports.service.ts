import { Injectable } from '@nestjs/common';
import { AccountType } from '@prisma/client';
import { Money } from '@workshopos/shared';
import { PrismaService } from '../prisma/prisma.service';

function isDebitNormal(type: AccountType): boolean {
  return type === 'ASSET' || type === 'EXPENSE';
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Sum of debit/credit per account up to an optional date. */
  private async balances(upto?: Date) {
    const grouped = await this.prisma.journalLine.groupBy({
      by: ['accountId'],
      _sum: { debit: true, credit: true },
      where: upto ? { entry: { date: { lte: upto } } } : undefined,
    });
    const map = new Map<string, { debit: Money; credit: Money }>();
    for (const g of grouped) {
      map.set(g.accountId, {
        debit: Money.of(g._sum.debit?.toString() ?? '0'),
        credit: Money.of(g._sum.credit?.toString() ?? '0'),
      });
    }
    return map;
  }

  async trialBalance(asOf?: string) {
    const upto = asOf ? new Date(asOf) : undefined;
    const [accounts, bal] = await Promise.all([
      this.prisma.account.findMany({ where: { isPostable: true }, orderBy: { code: 'asc' } }),
      this.balances(upto),
    ]);
    let totalDebit = Money.zero();
    let totalCredit = Money.zero();
    const rows = accounts
      .map((a) => {
        const b = bal.get(a.id) ?? { debit: Money.zero(), credit: Money.zero() };
        const net = b.debit.subtract(b.credit);
        const debit = !net.isNegative() ? net : Money.zero();
        const credit = net.isNegative() ? net.negate() : Money.zero();
        return { code: a.code, name: a.name, type: a.type, debit: debit.toString(), credit: credit.toString(), _d: debit, _c: credit };
      })
      .filter((r) => !(Money.of(r.debit).isZero() && Money.of(r.credit).isZero()));
    for (const r of rows) {
      totalDebit = totalDebit.add(r._d);
      totalCredit = totalCredit.add(r._c);
    }
    return {
      asOf: asOf ?? null,
      rows: rows.map(({ _d, _c, ...r }) => r),
      totalDebit: totalDebit.toString(),
      totalCredit: totalCredit.toString(),
      balanced: totalDebit.equals(totalCredit),
    };
  }

  async profitAndLoss(from?: string, to?: string) {
    const grouped = await this.prisma.journalLine.groupBy({
      by: ['accountId'],
      _sum: { debit: true, credit: true },
      where: {
        entry: { date: { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined } },
        account: { type: { in: ['INCOME', 'EXPENSE'] } },
      },
    });
    const accounts = await this.prisma.account.findMany({ where: { type: { in: ['INCOME', 'EXPENSE'] } } });
    const byId = new Map(accounts.map((a) => [a.id, a]));

    const income: { code: string; name: string; amount: string }[] = [];
    const expense: { code: string; name: string; amount: string }[] = [];
    let totalIncome = Money.zero();
    let totalExpense = Money.zero();

    for (const g of grouped) {
      const acc = byId.get(g.accountId);
      if (!acc) continue;
      const debit = Money.of(g._sum.debit?.toString() ?? '0');
      const credit = Money.of(g._sum.credit?.toString() ?? '0');
      if (acc.type === 'INCOME') {
        const amt = credit.subtract(debit);
        income.push({ code: acc.code, name: acc.name, amount: amt.toString() });
        totalIncome = totalIncome.add(amt);
      } else {
        const amt = debit.subtract(credit);
        expense.push({ code: acc.code, name: acc.name, amount: amt.toString() });
        totalExpense = totalExpense.add(amt);
      }
    }

    return {
      from: from ?? null,
      to: to ?? null,
      income,
      expense,
      totalIncome: totalIncome.toString(),
      totalExpense: totalExpense.toString(),
      netProfit: totalIncome.subtract(totalExpense).toString(),
    };
  }

  async balanceSheet(asOf?: string) {
    const upto = asOf ? new Date(asOf) : undefined;
    const [accounts, bal] = await Promise.all([
      this.prisma.account.findMany({ where: { isPostable: true } }),
      this.balances(upto),
    ]);
    const section = (type: AccountType) => {
      const rows: { code: string; name: string; amount: string }[] = [];
      let total = Money.zero();
      for (const a of accounts.filter((x) => x.type === type)) {
        const b = bal.get(a.id) ?? { debit: Money.zero(), credit: Money.zero() };
        const amt = isDebitNormal(type) ? b.debit.subtract(b.credit) : b.credit.subtract(b.debit);
        if (amt.isZero()) continue;
        rows.push({ code: a.code, name: a.name, amount: amt.toString() });
        total = total.add(amt);
      }
      return { rows, total };
    };

    const assets = section('ASSET');
    const liabilities = section('LIABILITY');
    const equity = section('EQUITY');
    // Current-period earnings fold into equity for the balance sheet.
    const income = section('INCOME');
    const expense = section('EXPENSE');
    const retained = income.total.subtract(expense.total);
    const equityTotal = equity.total.add(retained);

    return {
      asOf: asOf ?? null,
      assets: { ...assets, total: assets.total.toString(), rows: assets.rows },
      liabilities: { ...liabilities, total: liabilities.total.toString(), rows: liabilities.rows },
      equity: {
        rows: [...equity.rows, { code: '—', name: 'Current earnings', amount: retained.toString() }],
        total: equityTotal.toString(),
      },
      assetsTotal: assets.total.toString(),
      liabilitiesAndEquity: liabilities.total.add(equityTotal).toString(),
    };
  }

  async receivablesAging() {
    const invoices = await this.prisma.invoice.findMany({
      where: { status: { in: ['POSTED', 'PARTIALLY_PAID'] } },
      include: { customer: { select: { name: true } } },
    });
    return this.bucketize(invoices.map((i) => ({
      party: i.customer.name,
      ref: i.number ?? '(draft)',
      date: i.date,
      outstanding: Money.of(i.total.toString()).subtract(i.amountPaid.toString()),
    })));
  }

  async payablesAging() {
    const bills = await this.prisma.supplierBill.findMany({
      where: { status: { in: ['UNPAID', 'PARTIAL'] } },
      include: { supplier: { select: { name: true } } },
    });
    return this.bucketize(bills.map((b) => ({
      party: b.supplier.name,
      ref: b.number,
      date: b.date,
      outstanding: Money.of(b.total.toString()).subtract(b.amountPaid.toString()),
    })));
  }

  private bucketize(items: { party: string; ref: string; date: Date; outstanding: Money }[]) {
    const now = Date.now();
    const buckets = { current: Money.zero(), d30: Money.zero(), d60: Money.zero(), d90plus: Money.zero() };
    const rows = items
      .filter((i) => !i.outstanding.isZero() && !i.outstanding.isNegative())
      .map((i) => {
        const ageDays = Math.floor((now - i.date.getTime()) / 86400000);
        let bucket: keyof typeof buckets;
        if (ageDays <= 30) bucket = 'current';
        else if (ageDays <= 60) bucket = 'd30';
        else if (ageDays <= 90) bucket = 'd60';
        else bucket = 'd90plus';
        buckets[bucket] = buckets[bucket].add(i.outstanding);
        return { party: i.party, ref: i.ref, date: i.date, ageDays, outstanding: i.outstanding.toString(), bucket };
      });
    return {
      rows,
      totals: {
        current: buckets.current.toString(),
        d30: buckets.d30.toString(),
        d60: buckets.d60.toString(),
        d90plus: buckets.d90plus.toString(),
        total: buckets.current.add(buckets.d30).add(buckets.d60).add(buckets.d90plus).toString(),
      },
    };
  }
}
