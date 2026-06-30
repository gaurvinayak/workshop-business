import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

/**
 * Gap-free, per-(type, year) sequential document numbers. Always call inside
 * the same transaction that creates the document so a rollback also rolls back
 * the number — no gaps, no duplicates.
 *
 * e.g. next(tx, 'PO', 2026) -> "PO-2026-0001"
 */
@Injectable()
export class NumberingService {
  async next(tx: Tx, prefix: string, year: number): Promise<string> {
    const key = `${prefix.toLowerCase()}:${year}`;
    const seq = await tx.documentSequence.upsert({
      where: { key },
      create: { key, value: 1 },
      update: { value: { increment: 1 } },
    });
    return `${prefix}-${year}-${String(seq.value).padStart(4, '0')}`;
  }
}
