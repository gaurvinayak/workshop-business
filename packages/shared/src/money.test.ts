import { describe, it, expect } from 'vitest';
import { Money, sumMoney } from './money';

describe('Money', () => {
  it('does not lose precision the way floats do', () => {
    // 0.1 + 0.2 !== 0.3 in float land
    expect(Money.of('0.1').add('0.2').toString()).toBe('0.3000');
  });

  it('adds and subtracts', () => {
    expect(Money.of('100').add('50.25').toString()).toBe('150.2500');
    expect(Money.of('100').subtract('150').toString()).toBe('-50.0000');
  });

  it('computes percentages (tax)', () => {
    expect(Money.of('1000').percent(18).toString()).toBe('180.0000');
  });

  it('sums a list', () => {
    expect(sumMoney(['10', '20.5', '0.5']).toString()).toBe('31.0000');
  });

  it('compares and detects sign', () => {
    expect(Money.of('5').compare('3')).toBe(1);
    expect(Money.of('-1').isNegative()).toBe(true);
    expect(Money.zero().isZero()).toBe(true);
  });

  it('rounds half-up at scale', () => {
    expect(Money.of('1.00005').round().toString()).toBe('1.0001');
  });
});
