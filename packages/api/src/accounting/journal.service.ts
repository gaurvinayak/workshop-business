import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AppError,
  CreateJournalEntryInput,
  PaginationQuery,
  paginate,
  toSkipTake,
} from '@workshopos/shared';
import { PrismaService } from '../prisma/prisma.service';
import { assertBalanced } from './balancing';

type Tx = Prisma.TransactionClient;

@Injectable()
export class JournalService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Posts a balanced journal entry atomically. This is the one gateway through
   * which automated flows (invoices, payroll, ...) will also post in later
   * phases — they call `postWithinTransaction` from inside their own tx.
   */
  async postManual(input: CreateJournalEntryInput, postedById: string | undefined) {
    assertBalanced(input.lines);

    return this.prisma.$transaction((tx) =>
      this.postWithinTransaction(tx, {
        date: input.date,
        narration: input.narration,
        sourceType: 'manual',
        postedById,
        lines: input.lines,
      }),
    );
  }

  /** Reusable posting routine; callers supply their own transaction client. */
  async postWithinTransaction(
    tx: Tx,
    params: {
      date: string;
      narration: string;
      sourceType: string;
      sourceId?: string;
      postedById?: string;
      lines: { accountId: string; debit: string; credit: string; description?: string; partyType?: string; partyId?: string }[];
    },
  ) {
    assertBalanced(params.lines);

    const date = new Date(params.date);

    // The posting date must fall in an OPEN fiscal year.
    const fy = await tx.fiscalYear.findFirst({
      where: { startDate: { lte: date }, endDate: { gte: date }, status: 'OPEN' },
    });
    if (!fy) {
      throw AppError.validation(`No open fiscal year contains ${params.date}. Set one up or reopen the period.`);
    }

    // All referenced accounts must exist, be postable and active.
    const accountIds = [...new Set(params.lines.map((l) => l.accountId))];
    const accounts = await tx.account.findMany({ where: { id: { in: accountIds } } });
    if (accounts.length !== accountIds.length) {
      throw AppError.validation('One or more accounts do not exist');
    }
    for (const acc of accounts) {
      if (!acc.isPostable) throw AppError.validation(`Account ${acc.code} (${acc.name}) is a heading and cannot be posted to`);
      if (!acc.isActive) throw AppError.validation(`Account ${acc.code} is inactive`);
    }

    const number = await this.nextNumber(tx, date.getUTCFullYear());

    return tx.journalEntry.create({
      data: {
        number,
        date,
        narration: params.narration,
        sourceType: params.sourceType,
        sourceId: params.sourceId,
        fiscalYearId: fy.id,
        postedById: params.postedById,
        lines: {
          create: params.lines.map((l) => ({
            accountId: l.accountId,
            debit: l.debit,
            credit: l.credit,
            description: l.description,
            partyType: l.partyType,
            partyId: l.partyId,
          })),
        },
      },
      include: { lines: true },
    });
  }

  /** Resolve a system account id by its stable code (for automated postings). */
  async accountIdByCode(tx: Tx, code: string): Promise<string> {
    const acc = await tx.account.findUnique({ where: { code } });
    if (!acc) throw AppError.validation(`System account ${code} is missing from the chart of accounts`);
    return acc.id;
  }

  /** Gap-free, per-year sequential number generated inside the transaction. */
  private async nextNumber(tx: Tx, year: number): Promise<string> {
    const key = `journal:${year}`;
    const seq = await tx.documentSequence.upsert({
      where: { key },
      create: { key, value: 1 },
      update: { value: { increment: 1 } },
    });
    return `JE-${year}-${String(seq.value).padStart(4, '0')}`;
  }

  async list(q: PaginationQuery) {
    const { skip, take } = toSkipTake(q);
    const [rows, total] = await Promise.all([
      this.prisma.journalEntry.findMany({
        skip,
        take,
        orderBy: [{ date: 'desc' }, { number: 'desc' }],
        include: { lines: { include: { account: true } } },
      }),
      this.prisma.journalEntry.count(),
    ]);
    return paginate(rows, total, q);
  }

  async get(id: string) {
    const entry = await this.prisma.journalEntry.findUnique({
      where: { id },
      include: { lines: { include: { account: true } }, postedBy: true },
    });
    if (!entry) throw AppError.notFound('Journal entry');
    return entry;
  }
}
