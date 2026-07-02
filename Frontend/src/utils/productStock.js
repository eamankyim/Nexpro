const parseQuantity = (value) => {
  const qty = Number.parseFloat(value);
  return Number.isFinite(qty) ? qty : 0;
};

/**
 * Effective stock for display and availability checks.
 * Variant parents use the sum of active variant quantities.
 * @param {{ hasVariants?: boolean, quantityOnHand?: number | string | null, variants?: Array }} product
 * @returns {number}
 */
export const getProductStockQuantity = (product) => {
  if (!product) return 0;
  if (!product.hasVariants) return parseQuantity(product.quantityOnHand);

  const variants = Array.isArray(product.variants) ? product.variants : [];
  if (variants.length > 0) {
    return variants.reduce((total, variant) => {
      if (variant?.isActive === false) return total;
      return total + Math.max(parseQuantity(variant?.quantityOnHand), 0);
    }, 0);
  }

  return parseQuantity(product.quantityOnHand);
};
