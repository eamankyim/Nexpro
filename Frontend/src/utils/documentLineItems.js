/**
 * Resolve the unit abbreviation/symbol for a document line item (invoice, quote, receipt).
 * @param {Object} item - Line item
 * @returns {string} Unit symbol or empty string when unknown
 */
export function getLineItemUnitSymbol(item) {
  if (!item || typeof item !== 'object') return '';

  const metadata = item.metadata && typeof item.metadata === 'object' ? item.metadata : {};
  const specifications = item.specifications && typeof item.specifications === 'object'
    ? item.specifications
    : {};

  const candidates = [
    item.unitSymbol,
    item.unit,
    metadata.unitSymbol,
    metadata.unit,
    specifications.unitSymbol,
    specifications.unit,
    specifications.itemUnit,
    item.itemUnit,
    item.product?.unit,
  ];

  const unit = candidates
    .map((value) => (value == null ? '' : String(value).trim()))
    .find(Boolean);

  if (unit) return unit;

  if (item.pricingMethod === 'square_foot') {
    return 'sq ft';
  }

  return '';
}

/**
 * Format a quantity value, optionally with a unit symbol: `1 (sqm)` or `5` when no unit.
 * @param {number|string} quantity
 * @param {string} [unitSymbol]
 * @returns {string}
 */
export function formatDocumentQuantity(quantity, unitSymbol = '') {
  const parsed = parseFloat(quantity);
  const value = Number.isFinite(parsed) ? parsed : 1;
  const formatted = Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/\.?0+$/, '');

  const unit = unitSymbol ? String(unitSymbol).trim() : '';
  return unit ? `${formatted} (${unit})` : formatted;
}

/**
 * Format a line item quantity with its unit when available.
 * @param {Object} item - Line item
 * @param {number|string} [quantityOverride]
 * @returns {string}
 */
export function formatLineItemQuantity(item, quantityOverride) {
  const quantity = quantityOverride ?? item?.quantity ?? 1;
  return formatDocumentQuantity(quantity, getLineItemUnitSymbol(item));
}
