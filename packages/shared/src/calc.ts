import { Money } from './money';

/**
 * Pure financial calculations shared across modules. These are the
 * money-critical bits, kept side-effect-free so they can be unit-tested
 * without a database.
 */

export interface DocLineInput {
  quantity: string | number;
  rate: string | number;
  discount?: string | number;
  taxRate?: string | number; // percent, e.g. 18
}

export interface DocLineComputed {
  net: Money; // qty*rate - discount
  tax: Money;
  total: Money; // net + tax
}

export interface DocTotals {
  subtotal: Money; // sum of line nets
  taxTotal: Money;
  total: Money;
  lines: DocLineComputed[];
}

/** Compute per-line and document totals for an invoice/PO (tax-exclusive rates). */
export function computeDocumentTotals(lines: DocLineInput[]): DocTotals {
  let subtotal = Money.zero();
  let taxTotal = Money.zero();
  const computed: DocLineComputed[] = [];

  for (const line of lines) {
    const gross = Money.of(line.quantity).multiply(Money.of(line.rate).toString());
    const net = gross.subtract(Money.of(line.discount ?? 0)).round();
    const tax = net.percent(Money.of(line.taxRate ?? 0).toString()).round();
    subtotal = subtotal.add(net);
    taxTotal = taxTotal.add(tax);
    computed.push({ net, tax, total: net.add(tax) });
  }

  return { subtotal: subtotal.round(), taxTotal: taxTotal.round(), total: subtotal.add(taxTotal).round(), lines: computed };
}

/**
 * New moving-average cost after receiving `inQty` at `inUnitCost`.
 * Returns the blended unit cost. If total ends at zero, keeps the old average.
 */
export function movingAverageCost(
  currentQty: string | number,
  currentAvg: string | number,
  inQty: string | number,
  inUnitCost: string | number,
): Money {
  const curQ = Money.of(currentQty);
  const curValue = curQ.multiply(Money.of(currentAvg).toString());
  const inValue = Money.of(inQty).multiply(Money.of(inUnitCost).toString());
  const newQty = curQ.add(Money.of(inQty));
  if (newQty.isZero() || newQty.isNegative()) return Money.of(currentAvg).round();
  // Money has no divide-by-Money; divide via Decimal through string math.
  const newAvg = curValue.add(inValue).toNumber() / newQty.toNumber();
  return Money.of(newAvg.toFixed(4));
}

/** Prorate a monthly amount by paid days out of the month's total days. */
export function prorate(monthlyAmount: string | number, paidDays: number, daysInMonth: number): Money {
  if (daysInMonth <= 0) return Money.zero();
  const factor = paidDays / daysInMonth;
  return Money.of(monthlyAmount).multiply(factor.toFixed(8)).round();
}
