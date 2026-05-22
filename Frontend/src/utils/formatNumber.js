import { CURRENCY } from '../constants';

/** Fixed locale so decimals always use a period (e.g. 5.00 not 5,00). */
export const NUMBER_LOCALE = 'en-US';

/**
 * Coerce to a finite number (default 0).
 * @param {number|string|null|undefined} value
 * @returns {number}
 */
export function toNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const n = parseFloat(String(value ?? '').replace(/,/g, '.'));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Parse user-entered decimal text (accepts comma or period as decimal separator).
 * @param {string|number|null|undefined} value
 * @returns {number}
 */
export function parseDecimalInput(value) {
  if (value == null || value === '') return NaN;
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  const normalized = String(value).trim().replace(/\s/g, '').replace(/,/g, '.');
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Format a decimal number with fixed fraction digits.
 * @param {number|string|null|undefined} value
 * @param {number} [fractionDigits=2]
 * @returns {string}
 */
export function formatDecimal(value, fractionDigits = CURRENCY.DECIMAL_PLACES) {
  const n = toNumber(value);
  return n.toLocaleString(NUMBER_LOCALE, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

/**
 * Format integer counts (no decimal part).
 * @param {number|string|null|undefined} value
 * @returns {string}
 */
export function formatInteger(value) {
  const n = toNumber(value);
  return Math.round(n).toLocaleString(NUMBER_LOCALE);
}

/**
 * Format currency with symbol (default ₵).
 * @param {number|string|null|undefined} amount
 * @param {string} [symbol]
 * @param {number} [fractionDigits]
 * @returns {string}
 */
export function formatAmount(amount, symbol = CURRENCY.SYMBOL, fractionDigits = CURRENCY.DECIMAL_PLACES) {
  return `${symbol} ${formatDecimal(amount, fractionDigits)}`;
}
