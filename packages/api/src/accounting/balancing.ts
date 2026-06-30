import { Money, sumMoney, AppError } from '@workshopos/shared';

export interface RawLine {
  accountId: string;
  debit: string;
  credit: string;
}

/**
 * The single most important invariant in the system: a journal entry's debits
 * must equal its credits, and every line must be one-sided and non-negative.
 * Pure and synchronous so it can be unit-tested without a database.
 */
export function assertBalanced(lines: RawLine[]): { totalDebit: Money; totalCredit: Money } {
  if (lines.length < 2) {
    throw AppError.validation('A journal entry needs at least two lines');
  }

  for (const [i, line] of lines.entries()) {
    const debit = Money.of(line.debit);
    const credit = Money.of(line.credit);
    if (debit.isNegative() || credit.isNegative()) {
      throw AppError.validation(`Line ${i + 1}: amounts cannot be negative`);
    }
    if (!debit.isZero() && !credit.isZero()) {
      throw AppError.validation(`Line ${i + 1}: a line cannot have both a debit and a credit`);
    }
    if (debit.isZero() && credit.isZero()) {
      throw AppError.validation(`Line ${i + 1}: a line must have a debit or a credit`);
    }
  }

  const totalDebit = sumMoney(lines.map((l) => l.debit)).round();
  const totalCredit = sumMoney(lines.map((l) => l.credit)).round();

  if (!totalDebit.equals(totalCredit)) {
    throw AppError.validation(
      `Entry does not balance: debits ${totalDebit.toString()} ≠ credits ${totalCredit.toString()}`,
    );
  }
  if (totalDebit.isZero()) {
    throw AppError.validation('A journal entry cannot be for zero');
  }

  return { totalDebit, totalCredit };
}
