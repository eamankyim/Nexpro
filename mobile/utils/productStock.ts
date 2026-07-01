/**
 * Product stock helpers — aligned with web POS (`Frontend/src/pages/POS.jsx`).
 */

export type ProductStockInput = {
  trackStock?: boolean;
  quantityOnHand?: number | null;
  name?: string;
};

/** True when stock is tracked and on-hand quantity is zero or less. */
export function isProductOutOfStock(product: ProductStockInput | null | undefined): boolean {
  if (!product || product.trackStock === false) return false;
  const qty = Number(product.quantityOnHand);
  return Number.isFinite(qty) && qty <= 0;
}

export function getOutOfStockMessage(productName?: string): string {
  return `${productName || 'Product'} is out of stock and cannot be sold.`;
}

/** Max sellable quantity when stock is tracked; null means no cap. */
export function getMaxQuantityForCartItem(item: ProductStockInput | null | undefined): number | null {
  if (!item || item.trackStock === false) return null;
  const qty = Number(item.quantityOnHand);
  if (!Number.isFinite(qty)) return null;
  return Math.max(0, Math.floor(qty));
}

export type CartQuantityValidation =
  | { valid: true; quantity: number; removes?: boolean }
  | { valid: false; error: string };

export function validateCartQuantityInput(
  rawValue: string,
  item: ProductStockInput | null | undefined
): CartQuantityValidation {
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
