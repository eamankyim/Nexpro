import { CURRENCY } from '../constants';

export const NUMBER_LOCALE = 'en-US';

export function toNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const n = parseFloat(String(value ?? '').replace(/,/g, '.'));
  return Number.isFinite(n) ? n : 0;
}

export function formatDecimal(value, fractionDigits = CURRENCY.DECIMAL_PLACES) {
  const n = toNumber(value);
  return n.toLocaleString(NUMBER_LOCALE, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

export function formatInteger(value) {
  const n = toNumber(value);
  return Math.round(n).toLocaleString(NUMBER_LOCALE);
}

export function formatAmount(amount, symbol = CURRENCY.SYMBOL, fractionDigits = CURRENCY.DECIMAL_PLACES) {
  return `${symbol} ${formatDecimal(amount, fractionDigits)}`;
}
