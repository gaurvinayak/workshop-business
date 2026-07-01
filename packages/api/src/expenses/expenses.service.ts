import { Injectable } from '@nestjs/common';
import { ACCOUNT_CODES, AppError, CreateExpenseInput, Money } from '@workshopos/shared';
import { PrismaService } from '../prisma/prisma.service';
import { JournalService } from '../accounting/journal.service';
import { NumberingService } from '../common/numbering.service';

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journal: JournalService,
    private readonly numbering: NumberingService,
  ) {}

  list() {
    return this.prisma.expense.findMany({ orderBy: { date: 'desc' }, include: { supplier: { select: { name: true } } } });
  }

  /** Record a business expense (rent, utilities, ...) and post it. */
  async create(input: CreateExpenseInput, userId: string) {
    const amount = Money.of(input.amount);
    const tax = Money.of(input.taxAmount);
    const total = amount.add(tax);
    if (amount.isNegative() || amount.isZero()) throw AppError.validation('Amount must be positive');

    return this.prisma.$transaction(async (tx) => {
      const account = await tx.account.findUnique({ where: { code: input.accountCode } });
      if (!account || !account.isPostable) throw AppError.validation('Choose a valid, postable expense account');

      const number = await this.numbering.next(tx, 'EXP', new Date(input.date).getUTCFullYear());
      const expense = await tx.expense.create({
        data: {
          number, date: new Date(input.date), accountCode: input.accountCode, description: input.description,
          amount: input.amount, taxAmount: input.taxAmount, method: input.method, supplierId: input.supplierId,
          recurring: input.recurring,
        },
      });

      const [expenseAcc, inputTax, cashOrBank] = await Promise.all([
        this.journal.accountIdByCode(tx, input.accountCode),
        this.journal.accountIdByCode(tx, ACCOUNT_CODES.INPUT_TAX),
        this.journal.accountIdByCode(tx, input.method === 'CASH' ? ACCOUNT_CODES.CASH : ACCOUNT_CODES.BANK),
      ]);
      const entry = await this.journal.postWithinTransaction(tx, {
        date: input.date, narration: `Expense ${number}: ${input.description}`, sourceType: 'expense', sourceId: expense.id, postedById: userId,
        lines: [
          { accountId: expenseAcc, debit: amount.toString(), credit: '0' },
          ...(tax.isZero() ? [] : [{ accountId: inputTax, debit: tax.toString(), credit: '0' }]),
          { accountId: cashOrBank, debit: '0', credit: total.toString() },
        ],
      });
      return tx.expense.update({ where: { id: expense.id }, data: { journalEntryId: entry.id } });
    });
  }
}
