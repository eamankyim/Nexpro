/** Fixed locale so decimals always use a period (e.g. 5.00 not 5,00). */
const NUMBER_LOCALE = 'en-US';
const DEFAULT_FRACTION_DIGITS = 2;

/**
 * @param {number|string|null|undefined} value
 * @returns {number}
 */
const toNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const n = parseFloat(String(value ?? '').replace(/,/g, '.'));
  return Number.isFinite(n) ? n : 0;
};

/**
 * @param {number|string|null|undefined} value
 * @param {number} [fractionDigits=2]
 * @returns {string}
 */
const formatDecimal = (value, fractionDigits = DEFAULT_FRACTION_DIGITS) => {
  const n = toNumber(value);
  return n.toLocaleString(NUMBER_LOCALE, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
};

/**
 * @param {number|string|null|undefined} amount
 * @param {string} [currency='GHS']
 * @returns {string}
 */
const formatCurrency = (amount, currency = 'GHS') => {
  return `${currency} ${formatDecimal(amount)}`;
};

/**
 * Ghana cedi display (matches app UI).
 * @param {number|string|null|undefined} amount
 * @returns {string}
 */
const formatCedi = (amount) => `₵ ${formatDecimal(amount)}`;

module.exports = {
  NUMBER_LOCALE,
  toNumber,
  formatDecimal,
  formatInteger: (value) => Math.round(toNumber(value)).toLocaleString(NUMBER_LOCALE),
  formatCurrency,
  formatCedi,
};
