import { CURRENCY, CURRENCIES } from '../constants';

const ALLOWED_STORE_CURRENCY_CODES = new Set(CURRENCIES.map((item) => item.code));

/**
 * Resolve store currency to a known ISO code only.
 * Rejects template ids (e.g. "marketplace"), display names, and non-code shapes.
 * @param {...unknown} values - Candidates in priority order
 * @returns {string} ISO currency code (e.g. GHS)
 * @example
 * resolveStoreCurrencyCode('marketplace', 'GHS') // 'GHS'
 * resolveStoreCurrencyCode({ code: 'USD' }) // 'USD'
 */
export const resolveStoreCurrencyCode = (...values) => {
  for (const value of values) {
    let raw = value;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      raw = raw.code ?? raw.currency ?? raw.value;
    }
    const code = String(raw ?? '').trim().toUpperCase();
    if (ALLOWED_STORE_CURRENCY_CODES.has(code)) return code;
  }
  return CURRENCY.CODE;
};

export const STORE_CURRENCY_CODES = CURRENCIES.map((item) => item.code);
