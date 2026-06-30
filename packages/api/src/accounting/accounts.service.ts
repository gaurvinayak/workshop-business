import { Injectable } from '@nestjs/common';
import { AccountType } from '@prisma/client';
import { AppError, CreateAccountInput, Money } from '@workshopos/shared';
import { PrismaService } from '../prisma/prisma.service';

/** Asset & expense accounts increase on the debit side; the rest on the credit side. */
function isDebitNormal(type: AccountType): boolean {
  return type === 'ASSET' || type === 'EXPENSE';
}

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.account.findMany({ orderBy: { code: 'asc' } });
  }

  async create(input: CreateAccountInput) {
    const existing = await this.prisma.account.findUnique({ where: { code: input.code } });
    if (existing) throw AppError.conflict(`Account code ${input.code} already exists`);

    if (input.parentId) {
      const parent = await this.prisma.account.findUnique({ where: { id: input.parentId } });
      if (!parent) throw AppError.validation('Parent account does not exist');
      if (parent.type !== input.type) {
        throw AppError.validation('A sub-account must have the same type as its parent');
      }
    }

    return this.prisma.account.create({
      data: {
        code: input.code,
        name: input.name,
        type: input.type,
        parentId: input.parentId ?? null,
        isPostable: input.isPostable,
      },
    });
  }

  /** Account ledger: chronological lines with a running balance. */
  async ledger(accountId: string) {
    const account = await this.prisma.account.findUnique({ where: { id: accountId } });
    if (!account) throw AppError.notFound('Account');

    const lines = await this.prisma.journalLine.findMany({
      where: { accountId },
      include: { entry: true },
      orderBy: [{ entry: { date: 'asc' } }, { entry: { number: 'asc' } }],
    });

    const debitNormal = isDebitNormal(account.type);
    let running = Money.zero();
    const rows = lines.map((l) => {
      const debit = Money.of(l.debit.toString());
      const credit = Money.of(l.credit.toString());
      const delta = debitNormal ? debit.subtract(credit) : credit.subtract(debit);
      running = running.add(delta);
      return {
        entryId: l.entryId,
        number: l.entry.number,
        date: l.entry.date,
        narration: l.entry.narration,
        description: l.description,
        debit: debit.toString(),
        credit: credit.toString(),
        balance: running.toString(),
      };
    });

    return {
      account: { id: account.id, code: account.code, name: account.name, type: account.type },
      balance: running.toString(),
      lines: rows,
    };
  }
}
