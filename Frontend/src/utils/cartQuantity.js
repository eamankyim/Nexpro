/**
 * Cart quantity validation for POS.
 */

/**
 * @param {{ trackStock?: boolean, quantityOnHand?: number | null } | null | undefined} item
 * @returns {number | null} Max sellable quantity, or null when stock is not tracked.
 */
export function getMaxQuantityForCartItem(item) {
  if (!item || item.trackStock === false) return null;
  const qty = Number(item.quantityOnHand);
  if (!Number.isFinite(qty)) return null;
  return Math.max(0, Math.floor(qty));
}

/**
 * @param {string} rawValue
 * @param {{ trackStock?: boolean, quantityOnHand?: number | null } | null | undefined} item
 * @returns {{ valid: true, quantity: number, removes?: boolean } | { valid: false, error: string }}
 */
export function validateCartQuantityInput(rawValue, item) {
  const trimmed = String(rawValue ?? '').trim();
  if (!trimmed) {
    return { valid: false, error: 'Enter a quantity' };
  }
  if (!/^\d+$/.test(trimmed)) {
    return { valid: false, error: 'Whole numbers only' };
  }

  const quantity = parseInt(trimmed, 10);
  if (!Number.isFinite(quantity)) {
    return { valid: false, error: 'Enter a valid quantity' };
  }
  if (quantity <= 0) {
    return { valid: true, quantity: 0, removes: true };
  }

  const max = getMaxQuantityForCartItem(item);
  if (max !== null && quantity > max) {
    const label = max === 0 ? 'Out of stock' : `Only ${max} in stock`;
    return { valid: false, error: label };
  }

  return { valid: true, quantity };
}
