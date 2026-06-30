import { describe, it, expect } from 'vitest';
import { assertBalanced } from './balancing';

const line = (accountId: string, debit = '0', credit = '0') => ({ accountId, debit, credit });

describe('assertBalanced', () => {
  it('accepts a balanced two-line entry', () => {
    const { totalDebit } = assertBalanced([line('a', '100', '0'), line('b', '0', '100')]);
    expect(totalDebit.toString()).toBe('100.0000');
  });

  it('accepts a balanced multi-line entry (e.g. invoice with tax)', () => {
    expect(() =>
      assertBalanced([
        line('ar', '118', '0'),
        line('sales', '0', '100'),
        line('tax', '0', '18'),
      ]),
    ).not.toThrow();
  });

  it('rejects unbalanced entries', () => {
    expect(() => assertBalanced([line('a', '100', '0'), line('b', '0', '90')])).toThrow(/does not balance/);
  });

  it('rejects a line with both debit and credit', () => {
    expect(() => assertBalanced([line('a', '50', '50'), line('b', '0', '100')])).toThrow(/both a debit and a credit/);
  });

  it('rejects negative amounts', () => {
    expect(() => assertBalanced([line('a', '-100', '0'), line('b', '0', '-100')])).toThrow(/cannot be negative/);
  });

  it('rejects fewer than two lines', () => {
    expect(() => assertBalanced([line('a', '100', '0')])).toThrow(/at least two lines/);
  });

  it('rejects a zero entry', () => {
    expect(() => assertBalanced([line('a', '0', '0'), line('b', '0', '0')])).toThrow();
  });
});
