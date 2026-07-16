const { Op } = require('sequelize');
const { sequelize } = require('../../../config/database');
const { Product } = require('../../../models');
const { resolveTenantMeta } = require('./sales');

/**
 * Low-stock products (retail).
 * @param {Object} ctx
 */
async function getLowStock(ctx) {
  const meta = await resolveTenantMeta(ctx.tenantId);
  if (!meta.isRetail) {
    return {
      isRetail: false,
      lowStockCount: 0,
      products: [],
      note: 'Low stock alerts are available for shop and pharmacy workspaces.',
    };
  }

  const where = {
    tenantId: ctx.tenantId,
    isActive: true,
    trackStock: true,
    [Op.and]: [
      sequelize.where(sequelize.col('quantityOnHand'), Op.lte, sequelize.col('reorderLevel')),
    ],
  };
  if (ctx.shopFilterId) where.shopId = ctx.shopFilterId;

  const products = await Product.findAll({
    where,
    attributes: ['name', 'quantityOnHand', 'reorderLevel', 'unit'],
    limit: 12,
    order: [['quantityOnHand', 'ASC']],
  });

  const list = (products || []).map((p) => ({
    name: p.name,
    quantityOnHand: Number(parseFloat(p.quantityOnHand || 0)),
    reorderLevel: Number(parseFloat(p.reorderLevel || 0)),
    unit: p.unit,
  }));

  return {
    isRetail: true,
    lowStockCount: list.length,
    products: list,
  };
}

module.exports = {
  getLowStock,
};
