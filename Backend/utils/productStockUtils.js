const { Product, ProductVariant } = require('../models');

const parseQuantity = (value) => {
  const qty = Number.parseFloat(value);
  return Number.isFinite(qty) ? qty : 0;
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
};
