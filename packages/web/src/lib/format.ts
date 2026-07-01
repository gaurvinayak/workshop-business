/** Format a money value (string or number) with grouped thousands and 2 dp. */
export function money(value: string | number | null | undefined, currency?: string): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(n)) return String(value);
  const formatted = n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency ? `${currencySymbol(currency)}${formatted}` : formatted;
}

/** Format a quantity: up to 3 dp, trailing zeros trimmed. */
export function qty(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(n)) return String(value);
  return n.toLocaleString('en-IN', { maximumFractionDigits: 3 });
}

const SYMBOLS: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'د.إ ', AUD: 'A$' };
export function currencySymbol(code?: string): string {
  if (!code) return '';
  return SYMBOLS[code.toUpperCase()] ?? `${code} `;
}
