const { Op } = require('sequelize');
const { Product, ProductVariant, DealerProductPrice } = require('../models');
const { applyTenantFilter } = require('../utils/tenantUtils');
const { roundMoney } = require('./dealerBalanceService');

const NULL_VARIANT_SENTINEL = '00000000-0000-0000-0000-000000000000';

const variantWhere = (variantId) => (
  variantId
    ? { productVariantId: variantId }
    : { productVariantId: { [Op.is]: null } }
);

/**
 * Resolve unit price for a dealer at a branch: dealer-specific → tier → retail sellingPrice.
 * @param {object} params
 * @param {string} params.tenantId
 * @param {string} params.shopId
 * @param {string} params.dealerId
 * @param {string} params.productId
 * @param {string|null} [params.productVariantId]
 * @param {string|null} [params.priceTierId]
 * @returns {Promise<{ unitPrice: number, source: 'dealer'|'tier'|'retail', retailPrice: number|null }>}
 */
const resolvePrice = async ({
  tenantId,
  shopId,
  dealerId,
  productId,
  productVariantId = null,
  priceTierId = null,
}) => {
  if (!tenantId || !shopId || !productId) {
    throw new Error('tenantId, shopId, and productId are required for price resolution');
  }

  const baseWhere = applyTenantFilter(tenantId, {
    shopId,
    productId,
    isActive: true,
    ...variantWhere(productVariantId),
  });

  if (dealerId) {
    const dealerPrice = await DealerProductPrice.findOne({
      where: { ...baseWhere, dealerId },
      attributes: ['unitPrice'],
    });
    if (dealerPrice) {
      return {
        unitPrice: roundMoney(dealerPrice.unitPrice),
        source: 'dealer',
        retailPrice: null,
      };
    }
  }

  if (priceTierId) {
    const tierPrice = await DealerProductPrice.findOne({
      where: { ...baseWhere, priceTierId, dealerId: { [Op.is]: null } },
      attributes: ['unitPrice'],
    });
    if (tierPrice) {
      return {
        unitPrice: roundMoney(tierPrice.unitPrice),
        source: 'tier',
        retailPrice: null,
      };
    }
  }

  let retailPrice = null;
  if (productVariantId) {
    const variant = await ProductVariant.findOne({
      where: applyTenantFilter(tenantId, { id: productVariantId, productId }),
      attributes: ['sellingPrice'],
    });
    retailPrice = variant ? roundMoney(variant.sellingPrice) : null;
  }

  if (retailPrice == null) {
    const product = await Product.findOne({
      where: applyTenantFilter(tenantId, { id: productId, shopId }),
      attributes: ['sellingPrice'],
    });
    retailPrice = product ? roundMoney(product.sellingPrice) : 0;
  }

  return {
    unitPrice: retailPrice,
    source: 'retail',
    retailPrice,
  };
};

/**
 * Resolve prices for multiple catalog items.
 * @param {object} params
 * @param {Array<{ productId: string, productVariantId?: string|null }>} params.items
 */
const resolvePricesForItems = async ({ tenantId, shopId, dealerId, priceTierId, items = [] }) => {
  const results = {};
  for (const item of items) {
    const key = `${item.productId}:${item.productVariantId || NULL_VARIANT_SENTINEL}`;
    results[key] = await resolvePrice({
      tenantId,
      shopId,
      dealerId,
      productId: item.productId,
      productVariantId: item.productVariantId || null,
      priceTierId,
    });
  }
  return results;
};

/**
 * List dealer-specific prices for a branch catalog.
 */
const listDealerPrices = async ({ tenantId, shopId, dealerId, search = '' }) => {
  const where = applyTenantFilter(tenantId, {
    shopId,
    dealerId,
    isActive: true,
  });

  const include = [
    {
      model: Product,
      as: 'product',
      attributes: ['id', 'name', 'sku', 'sellingPrice', 'shopId'],
      where: search
        ? {
          [Op.or]: [
            { name: { [Op.iLike]: `%${search}%` } },
            { sku: { [Op.iLike]: `%${search}%` } },
          ],
        }
        : undefined,
      required: !!search,
    },
    {
      model: ProductVariant,
      as: 'variant',
      attributes: ['id', 'name', 'sku', 'sellingPrice'],
      required: false,
    },
  ];

  return DealerProductPrice.findAll({
    where,
    include,
    order: [['updatedAt', 'DESC']],
  });
};

/**
 * Upsert dealer product prices for a branch.
 * @param {object} params
 * @param {Array<{ productId: string, productVariantId?: string|null, unitPrice: number }>} params.prices
 */
const upsertDealerPrices = async ({ tenantId, shopId, dealerId, prices = [], transaction = null }) => {
  const results = [];
  for (const row of prices) {
    const unitPrice = roundMoney(row.unitPrice);
    const where = applyTenantFilter(tenantId, {
      shopId,
      dealerId,
      productId: row.productId,
      ...variantWhere(row.productVariantId || null),
    });

    const existing = await DealerProductPrice.findOne({ where, transaction });
    if (existing) {
      await existing.update({ unitPrice, isActive: true }, { transaction });
      results.push(existing);
    } else {
      const created = await DealerProductPrice.create({
        tenantId,
        shopId,
        dealerId,
        productId: row.productId,
        productVariantId: row.productVariantId || null,
        unitPrice,
        isActive: true,
      }, { transaction });
      results.push(created);
    }
  }
  return results;
};

module.exports = {
  resolvePrice,
  resolvePricesForItems,
  listDealerPrices,
  upsertDealerPrices,
};
