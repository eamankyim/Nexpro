const { Product, ProductVariant, ProductCategory, Drug, MaterialCategory } = require('../models');
const { applyTenantFilter } = require('../utils/tenantUtils');
const { applyShopReadFilter } = require('../utils/shopUtils');
const { resolveBusinessType } = require('../config/businessTypes');
const { parseQuantity } = require('../utils/productStockUtils');

/**
 * Merchandise = read-only overview of sellable product/drug stock value (Assets group).
 * Not a CRUD surface — no create/update/delete here; deep-link to Products/Drugs for edits.
 */

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

/**
 * Build merchandise rows from the Product catalog (shop tenants), variant-aware:
 * each active variant's own cost/selling price (falling back to the parent product's)
 * is multiplied by its own quantity on hand.
 * @param {object} req
 * @returns {Promise<Array<{id, name, sku, category, quantityOnHand, costValue, sellingValue}>>}
 */
const buildProductMerchandiseRows = async (req) => {
  let where = applyTenantFilter(req.tenantId, { isActive: true });
  if (req.shopScoped) {
    where = applyShopReadFilter(req, where);
  }

  const products = await Product.findAll({
    where,
    attributes: ['id', 'name', 'sku', 'quantityOnHand', 'costPrice', 'sellingPrice', 'hasVariants'],
    include: [
      { model: ProductCategory, as: 'category', attributes: ['id', 'name'], required: false },
      {
        model: ProductVariant,
        as: 'variants',
        required: false,
        where: { isActive: true },
        attributes: ['id', 'quantityOnHand', 'costPrice', 'sellingPrice'],
      },
    ],
    order: [['name', 'ASC']],
  });

  return products.map((product) => {
    const plain = product.get({ plain: true });
    let quantityOnHand = 0;
    let costValue = 0;
    let sellingValue = 0;

    if (plain.hasVariants && Array.isArray(plain.variants) && plain.variants.length > 0) {
      plain.variants.forEach((variant) => {
        const qty = Math.max(parseQuantity(variant.quantityOnHand), 0);
        const cost = variant.costPrice != null ? parseFloat(variant.costPrice) : parseFloat(plain.costPrice || 0);
        const selling = variant.sellingPrice != null ? parseFloat(variant.sellingPrice) : parseFloat(plain.sellingPrice || 0);
        quantityOnHand += qty;
        costValue += qty * (Number.isFinite(cost) ? cost : 0);
        sellingValue += qty * (Number.isFinite(selling) ? selling : 0);
      });
    } else {
      quantityOnHand = Math.max(parseQuantity(plain.quantityOnHand), 0);
      costValue = quantityOnHand * parseFloat(plain.costPrice || 0);
      sellingValue = quantityOnHand * parseFloat(plain.sellingPrice || 0);
    }

    return {
      id: plain.id,
      name: plain.name,
      sku: plain.sku || null,
      category: plain.category?.name || null,
      quantityOnHand: round2(quantityOnHand),
      costValue: round2(costValue),
      sellingValue: round2(sellingValue),
    };
  });
};

/**
 * Build merchandise rows from the Drug catalog (pharmacy tenants).
 * @param {object} req
 * @returns {Promise<Array<{id, name, sku, category, quantityOnHand, costValue, sellingValue}>>}
 */
const buildDrugMerchandiseRows = async (req) => {
  const where = applyTenantFilter(req.tenantId, { isActive: true });

  const drugs = await Drug.findAll({
    where,
    attributes: ['id', 'name', 'sku', 'quantityOnHand', 'costPrice', 'sellingPrice'],
    include: [{ model: MaterialCategory, as: 'category', attributes: ['id', 'name'], required: false }],
    order: [['name', 'ASC']],
  });

  return drugs.map((drug) => {
    const plain = drug.get({ plain: true });
    const quantityOnHand = Math.max(parseQuantity(plain.quantityOnHand), 0);
    const costValue = quantityOnHand * parseFloat(plain.costPrice || 0);
    const sellingValue = quantityOnHand * parseFloat(plain.sellingPrice || 0);

    return {
      id: plain.id,
      name: plain.name,
      sku: plain.sku || null,
      category: plain.category?.name || null,
      quantityOnHand: round2(quantityOnHand),
      costValue: round2(costValue),
      sellingValue: round2(sellingValue),
    };
  });
};

const sumTotals = (items) => {
  const totals = items.reduce(
    (acc, item) => {
      acc.totalItems += 1;
      acc.totalQuantity += item.quantityOnHand;
      acc.totalCostValue += item.costValue;
      acc.totalSellingValue += item.sellingValue;
      return acc;
    },
    { totalItems: 0, totalQuantity: 0, totalCostValue: 0, totalSellingValue: 0 }
  );
  totals.totalQuantity = round2(totals.totalQuantity);
  totals.totalCostValue = round2(totals.totalCostValue);
  totals.totalSellingValue = round2(totals.totalSellingValue);
  return totals;
};

// @desc    Get merchandise (sellable product/drug stock) overview with cost & selling value totals
// @route   GET /api/merchandise/summary
// @access  Private (admin, manager) — route-level `authorize` also gates staff out entirely
exports.getMerchandiseSummary = async (req, res, next) => {
  try {
    const businessType = resolveBusinessType(req.tenant?.businessType);
    const supported = businessType === 'shop' || businessType === 'pharmacy';

    let items = [];
    if (businessType === 'shop') {
      items = await buildProductMerchandiseRows(req);
    } else if (businessType === 'pharmacy') {
      items = await buildDrugMerchandiseRows(req);
    }

    res.status(200).json({
      success: true,
      data: {
        businessType,
        supported,
        source: businessType === 'pharmacy' ? 'drugs' : 'products',
        items,
        totals: sumTotals(items),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Exported for unit tests
exports._buildProductMerchandiseRows = buildProductMerchandiseRows;
exports._buildDrugMerchandiseRows = buildDrugMerchandiseRows;
