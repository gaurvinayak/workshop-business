import { describe, it, expect } from 'vitest';
import { computeDocumentTotals, movingAverageCost, prorate } from './calc';

describe('computeDocumentTotals', () => {
  it('computes net, tax and total for a simple line', () => {
    const t = computeDocumentTotals([{ quantity: '10', rate: '100', taxRate: '18' }]);
    expect(t.subtotal.toString()).toBe('1000.0000');
    expect(t.taxTotal.toString()).toBe('180.0000');
    expect(t.total.toString()).toBe('1180.0000');
  });

  it('applies a discount before tax', () => {
    const t = computeDocumentTotals([{ quantity: '2', rate: '500', discount: '100', taxRate: '10' }]);
    // gross 1000 - 100 = 900 net; tax 90; total 990
    expect(t.subtotal.toString()).toBe('900.0000');
    expect(t.taxTotal.toString()).toBe('90.0000');
    expect(t.total.toString()).toBe('990.0000');
  });

  it('sums multiple lines with mixed tax rates', () => {
    const t = computeDocumentTotals([
      { quantity: '1', rate: '100', taxRate: '18' },
      { quantity: '3', rate: '50', taxRate: '0' },
    ]);
    expect(t.subtotal.toString()).toBe('250.0000');
    expect(t.taxTotal.toString()).toBe('18.0000');
    expect(t.total.toString()).toBe('268.0000');
  });
});

describe('movingAverageCost', () => {
  it('blends cost on receipt', () => {
    // 10 @ 100 then receive 10 @ 120 -> avg 110
    expect(movingAverageCost('10', '100', '10', '120').toString()).toBe('110.0000');
  });

  it('first receipt sets the cost', () => {
    expect(movingAverageCost('0', '0', '5', '42').toString()).toBe('42.0000');
  });

  it('keeps old average when nothing is added', () => {
    expect(movingAverageCost('10', '100', '0', '0').toString()).toBe('100.0000');
  });
});

describe('prorate', () => {
  it('prorates by paid days', () => {
    expect(prorate('30000', 30, 30).toString()).toBe('30000.0000');
    expect(prorate('30000', 15, 30).toString()).toBe('15000.0000');
    expect(prorate('30000', 0, 30).toString()).toBe('0.0000');
  });
});
