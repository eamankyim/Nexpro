/**
 * First-party delivery lifecycle (jobs + sales). Public tracking prefers this timeline when set.
 */
const DELIVERY_STATUSES = Object.freeze([
  'ready_for_delivery',
  'out_for_delivery',
  'delivered',
  'returned'
]);

const DELIVERY_STATUS_INDEX = DELIVERY_STATUSES.reduce((acc, s, i) => {
  acc[s] = i;
  return acc;
}, {});

/**
 * @param {unknown} value
 * @returns {string|null|undefined} null = clear; undefined = invalid
 */
function parseDeliveryStatusInput(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const s = String(value).trim();
  if (!DELIVERY_STATUSES.includes(s)) return undefined;
  return s;
}

module.exports = {
  DELIVERY_STATUSES,
  DELIVERY_STATUS_INDEX,
  parseDeliveryStatusInput
};
