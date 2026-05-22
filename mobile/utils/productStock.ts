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
