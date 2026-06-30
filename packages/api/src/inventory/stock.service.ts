import { Injectable } from '@nestjs/common';
import { Prisma, StockMovementType } from '@prisma/client';
import { AppError, Money, movingAverageCost } from '@workshopos/shared';

type Tx = Prisma.TransactionClient;

export interface MovementParams {
  itemId: string;
  locationId: string;
  /** Signed: positive is stock-in, negative is stock-out. */
  quantity: string;
  /** Required for inbound; ignored for outbound (avg cost is used). */
  unitCost?: string;
  type: StockMovementType;
  refType?: string;
  refId?: string;
  note?: string;
  byUserId?: string;
  allowNegative?: boolean;
}

export interface MovementResult {
  movementId: string;
  /** The unit cost actually applied (received cost in, moving-avg out). */
  unitCost: Money;
  /** Absolute value moved = |qty| * unitCost — for ledger postings. */
  value: Money;
  newQuantity: Money;
  newAvgCost: Money;
}

/**
 * The single gateway for stock changes — keeps `stock_level` (running on-hand +
 * moving-average cost) in lockstep with the append-only `stock_movement` log.
 * Call inside the caller's transaction so stock and ledger move atomically.
 */
@Injectable()
export class StockService {
  async applyMovement(tx: Tx, p: MovementParams): Promise<MovementResult> {
    const qty = Money.of(p.quantity);
    if (qty.isZero()) throw AppError.validation('Movement quantity cannot be zero');

    const level = await tx.stockLevel.findUnique({
      where: { itemId_locationId: { itemId: p.itemId, locationId: p.locationId } },
    });
    const curQty = Money.of(level?.quantity?.toString() ?? '0');
    const curAvg = Money.of(level?.avgCost?.toString() ?? '0');

    let unitCost: Money;
    let newAvg: Money;

    if (!qty.isNegative()) {
      // Inbound: blend cost.
      unitCost = Money.of(p.unitCost ?? '0');
      newAvg = movingAverageCost(curQty.toString(), curAvg.toString(), qty.toString(), unitCost.toString());
    } else {
      // Outbound: leave at moving-average; that's the cost of goods leaving.
      unitCost = curAvg;
      newAvg = curAvg;
      const resulting = curQty.add(qty);
      if (resulting.isNegative() && !p.allowNegative) {
        throw AppError.validation(`Insufficient stock: on hand ${curQty.toString()}, requested ${qty.negate().toString()}`);
      }
    }

    const newQty = curQty.add(qty);

    await tx.stockLevel.upsert({
      where: { itemId_locationId: { itemId: p.itemId, locationId: p.locationId } },
      create: { itemId: p.itemId, locationId: p.locationId, quantity: newQty.toString(), avgCost: newAvg.toString() },
      update: { quantity: newQty.toString(), avgCost: newAvg.toString() },
    });

    const movement = await tx.stockMovement.create({
      data: {
        itemId: p.itemId,
        locationId: p.locationId,
        quantity: qty.toString(),
        unitCost: unitCost.toString(),
        type: p.type,
        refType: p.refType,
        refId: p.refId,
        note: p.note,
        byUserId: p.byUserId,
      },
    });

    const value = qty.isNegative() ? qty.negate().multiply(unitCost.toString()) : qty.multiply(unitCost.toString());
    return { movementId: movement.id, unitCost, value: value.round(), newQuantity: newQty, newAvgCost: newAvg };
  }
}
