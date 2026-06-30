import Decimal from 'decimal.js';

/**
 * Money helper. Never use JS floats for currency.
 *
 * Convention: amounts are stored in the DB as NUMERIC(18,4) and represented
 * in transit/app code as decimal strings (e.g. "1250.0000"). All arithmetic
 * goes through this class so rounding and precision are consistent everywhere.
 */
export class Money {
  private readonly value: Decimal;

  // 4 decimal places of internal precision, matching NUMERIC(18,4).
  static readonly SCALE = 4;

  private constructor(value: Decimal) {
    this.value = value;
  }

  static of(input: Money | Decimal | string | number): Money {
    if (input instanceof Money) return input;
    return new Money(new Decimal(input));
  }

  static zero(): Money {
    return new Money(new Decimal(0));
  }

  add(other: Money | string | number): Money {
    return new Money(this.value.plus(Money.of(other).value));
  }

  subtract(other: Money | string | number): Money {
    return new Money(this.value.minus(Money.of(other).value));
  }

  multiply(factor: string | number): Money {
    return new Money(this.value.times(factor));
  }

  /** Percentage of this amount, e.g. amount.percent(18) === 18% of amount. */
  percent(rate: string | number): Money {
    return new Money(this.value.times(rate).dividedBy(100));
  }

  negate(): Money {
    return new Money(this.value.negated());
  }

  isZero(): boolean {
    return this.value.isZero();
  }

  isNegative(): boolean {
    return this.value.isNegative();
  }

  equals(other: Money | string | number): boolean {
    return this.value.equals(Money.of(other).value);
  }

  compare(other: Money | string | number): number {
    return this.value.comparedTo(Money.of(other).value);
  }

  /** Round to the money scale (4 dp), half-up. */
  round(): Money {
    return new Money(this.value.toDecimalPlaces(Money.SCALE, Decimal.ROUND_HALF_UP));
  }

  /** Canonical string for storage/transit, e.g. "1250.0000". */
  toString(): string {
    return this.value.toFixed(Money.SCALE);
  }

  toNumber(): number {
    return this.value.toNumber();
  }
}

/** Sum a list of money-like values. */
export function sumMoney(values: Array<Money | string | number>): Money {
  return values.reduce<Money>((acc, v) => acc.add(Money.of(v)), Money.zero());
}
