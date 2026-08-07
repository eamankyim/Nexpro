const { Product, ProductVariant, ProductStockMovement } = require('../models');

const parseQuantity = (value) => {
  const qty = Number.parseFloat(value);
  return Number.isFinite(qty) ? qty : 0;
};

const MOVEMENT_TYPES = new Set(['receive', 'adjustment', 'transfer_in', 'transfer_out', 'return']);

/**
 * Infer movement type from explicit type, reason text, or quantity delta.
 * @param {{ type?: string, reason?: string, quantityDelta?: number }} opts
 * @returns {'receive'|'adjustment'|'transfer_in'|'transfer_out'|'return'}
 */
const resolveStockMovementType = ({ type, reason, quantityDelta } = {}) => {
  if (type && MOVEMENT_TYPES.has(String(type))) {
    return String(type);
  }
  const reasonText = String(reason || '').toLowerCase();
  if (reasonText.includes('receive') || reasonText.includes('restock')) {
    return 'receive';
  }
  if (reasonText.includes('transfer in') || reasonText.includes('transfer_in')) {
    return 'transfer_in';
  }
  if (reasonText.includes('transfer out') || reasonText.includes('transfer_out')) {
    return 'transfer_out';
  }
  if (reasonText.includes('return')) {
    return 'return';
  }
  if (parseQuantity(quantityDelta) > 0 && reasonText.includes('stock')) {
    return 'receive';
  }
  return 'adjustment';
};

/**
 * Persist a product (or variant) stock movement row.
 * @param {object} params
 * @param {string} params.tenantId
 * @param {string} params.productId
 * @param {string} [params.productVariantId]
 * @param {string} [params.shopId]
 * @param {string} [params.type]
 * @param {number} params.quantityDelta
 * @param {number} params.previousQuantity
 * @param {number} params.newQuantity
 * @param {string} [params.reason]
 * @param {string} [params.reference]
 * @param {string} [params.createdBy]
 * @param {object} [params.metadata]
 * @param {import('sequelize').Transaction} [params.transaction]
 * @returns {Promise<object|null>}
 */
const recordProductStockMovement = async ({
  tenantId,
  productId,
  productVariantId = null,
  shopId = null,
  type,
  quantityDelta,
  previousQuantity,
  newQuantity,
  reason = null,
  reference = null,
  createdBy = null,
  metadata = {},
  transaction,
} = {}) => {
  if (!tenantId || !productId) return null;

  const delta = parseQuantity(quantityDelta);
  if (delta === 0) return null;

  const movementType = resolveStockMovementType({ type, reason, quantityDelta: delta });

  return ProductStockMovement.create({
    tenantId,
    productId,
    productVariantId: productVariantId || null,
    shopId: shopId || null,
    type: movementType,
    quantityDelta: delta,
    previousQuantity: parseQuantity(previousQuantity),
    newQuantity: parseQuantity(newQuantity),
    reason: reason || null,
    reference: reference || null,
    createdBy: createdBy || null,
    occurredAt: new Date(),
    metadata: metadata && typeof metadata === 'object' ? metadata : {},
  }, { transaction });
};

const sumActiveVariantQuantity = (variants = []) => {
  if (!Array.isArray(variants)) return 0;
  return variants.reduce((total, variant) => {
    if (variant?.isActive === false) return total;
    return total + Math.max(parseQuantity(variant?.quantityOnHand), 0);
  }, 0);
};

const getEffectiveProductQuantityOnHand = (product) => {
  if (!product) return 0;
  if (!product.hasVariants) return parseQuantity(product.quantityOnHand);

  if (product.totalVariantStock != null) {
    return Math.max(parseQuantity(product.totalVariantStock), 0);
  }
  if (Array.isArray(product.variants) && product.variants.length > 0) {
    return sumActiveVariantQuantity(product.variants);
  }
  return parseQuantity(product.quantityOnHand);
};

const applyEffectiveProductQuantity = (product) => {
  if (!product || typeof product !== 'object') return product;

  const plain = typeof product.get === 'function'
    ? product.get({ plain: true })
    : { ...product };

  if (plain.hasVariants) {
    plain.quantityOnHand = getEffectiveProductQuantityOnHand(plain);
  }
  if (plain.totalVariantStock !== undefined) {
    delete plain.totalVariantStock;
  }
  return plain;
};

const syncParentQuantityFromVariants = async (productId, transaction) => {
  const product = await Product.findByPk(productId, { transaction });
  if (!product?.hasVariants) return product;

  const total = await ProductVariant.sum('quantityOnHand', {
    where: { productId, isActive: true },
    transaction,
  });

  const quantityOnHand = Math.max(parseQuantity(total), 0);
  await product.update({ quantityOnHand }, { transaction });
  return product;
};

module.exports = {
  parseQuantity,
  sumActiveVariantQuantity,
  getEffectiveProductQuantityOnHand,
  applyEffectiveProductQuantity,
  syncParentQuantityFromVariants,
  resolveStockMovementType,
  recordProductStockMovement,
  MOVEMENT_TYPES,
};
