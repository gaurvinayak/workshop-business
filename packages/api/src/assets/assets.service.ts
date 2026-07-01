import { Injectable } from '@nestjs/common';
import { ACCOUNT_CODES, AppError, CreateFixedAssetInput, Money } from '@workshopos/shared';
import { PrismaService } from '../prisma/prisma.service';
import { JournalService } from '../accounting/journal.service';

@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journal: JournalService,
  ) {}

  list() {
    return this.prisma.fixedAsset.findMany({ orderBy: { code: 'asc' } });
  }

  /** Register a fixed asset and capitalize it (Dr Fixed Assets, Cr Bank). */
  async create(input: CreateFixedAssetInput, userId: string) {
    const existing = await this.prisma.fixedAsset.findUnique({ where: { code: input.code } });
    if (existing) throw AppError.conflict(`Asset code ${input.code} already exists`);
    return this.prisma.$transaction(async (tx) => {
      const asset = await tx.fixedAsset.create({
        data: {
          code: input.code, name: input.name, purchaseDate: new Date(input.purchaseDate),
          cost: input.cost, salvageValue: input.salvageValue, usefulLifeMonths: input.usefulLifeMonths,
        },
      });
      const [fixedAssets, bank] = await Promise.all([
        this.journal.accountIdByCode(tx, ACCOUNT_CODES.FIXED_ASSETS),
        this.journal.accountIdByCode(tx, ACCOUNT_CODES.BANK),
      ]);
      await this.journal.postWithinTransaction(tx, {
        date: input.purchaseDate, narration: `Purchase asset ${input.code}`, sourceType: 'fixed_asset', sourceId: asset.id, postedById: userId,
        lines: [
          { accountId: fixedAssets, debit: input.cost, credit: '0' },
          { accountId: bank, debit: '0', credit: input.cost },
        ],
      });
      return asset;
    });
  }

  /** Straight-line monthly depreciation for a period, posted per asset. */
  async runDepreciation(period: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const assets = await tx.fixedAsset.findMany({ where: { isActive: true } });
      const results: { code: string; amount: string }[] = [];

      for (const asset of assets) {
        const already = await tx.depreciationEntry.findUnique({ where: { fixedAssetId_period: { fixedAssetId: asset.id, period } } });
        if (already) continue;

        const depreciable = Money.of(asset.cost.toString()).subtract(asset.salvageValue.toString());
        const accumulated = Money.of(asset.accumulatedDepreciation.toString());
        const remaining = depreciable.subtract(accumulated);
        if (remaining.isZero() || remaining.isNegative()) continue;

        const monthly = Money.of((depreciable.toNumber() / asset.usefulLifeMonths).toFixed(4));
        const amount = monthly.compare(remaining) <= 0 ? monthly : remaining;
        if (amount.isZero()) continue;

        const entry = await tx.depreciationEntry.create({ data: { fixedAssetId: asset.id, period, amount: amount.toString() } });
        await tx.fixedAsset.update({ where: { id: asset.id }, data: { accumulatedDepreciation: accumulated.add(amount).toString() } });

        const [depExpense, accDep] = await Promise.all([
          this.journal.accountIdByCode(tx, ACCOUNT_CODES.DEPRECIATION_EXPENSE),
          this.journal.accountIdByCode(tx, ACCOUNT_CODES.ACCUMULATED_DEPRECIATION),
        ]);
        const je = await this.journal.postWithinTransaction(tx, {
          date: `${period}-01`, narration: `Depreciation ${period}: ${asset.code}`, sourceType: 'depreciation', sourceId: entry.id, postedById: userId,
          lines: [
            { accountId: depExpense, debit: amount.toString(), credit: '0' },
            // Accumulated depreciation is a contra-asset; a credit reduces net assets.
            { accountId: accDep, debit: '0', credit: amount.toString() },
          ],
        });
        await tx.depreciationEntry.update({ where: { id: entry.id }, data: { journalEntryId: je.id } });
        results.push({ code: asset.code, amount: amount.toString() });
      }
      return { period, posted: results };
    });
  }
}
