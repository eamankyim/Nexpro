import { CURRENCY } from '@/constants';

/** Fixed locale so decimals always use a period (e.g. 5.00 not 5,00). */
export const NUMBER_LOCALE = 'en-US';

export function toNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const n = parseFloat(String(value ?? '').replace(/,/g, '.'));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Parse user-entered decimal text (accepts comma or period as decimal separator).
 */
export function parseDecimalInput(value: string | number | null | undefined): number {
  if (value == null || value === '') return NaN;
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  const normalized = String(value).trim().replace(/\s/g, '').replace(/,/g, '.');
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : NaN;
}

export function formatDecimal(
  value: number | string | null | undefined,
  fractionDigits: number = CURRENCY.DECIMAL_PLACES
): string {
  const n = toNumber(value);
  return n.toLocaleString(NUMBER_LOCALE, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

export function formatInteger(value: number | string | null | undefined): string {
  const n = toNumber(value);
  return Math.round(n).toLocaleString(NUMBER_LOCALE);
}

export function formatCurrency(value: number | string | null | undefined): string {
  return `${CURRENCY.SYMBOL} ${formatDecimal(value, CURRENCY.DECIMAL_PLACES)}`;
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString(NUMBER_LOCALE, { month: 'short', day: 'numeric', year: 'numeric' });
}
