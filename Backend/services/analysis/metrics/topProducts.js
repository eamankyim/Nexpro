const { sequelize } = require('../../../config/database');
const { resolveTenantMeta } = require('./sales');
const { resolveAnalysisPeriod } = require('./dates');
const { roundMoney } = require('../profitFormulas');

/**
 * Top products by revenue for the period (retail only).
 * @param {Object} ctx
 * @returns {Promise<{ products: Array, periodLabel: string, isRetail: boolean }>}
 */
async function getTopProducts(ctx) {
  const meta = await resolveTenantMeta(ctx.tenantId);
  const range = resolveAnalysisPeriod(
    { ...ctx, defaultPeriod: 'month' },
    ctx.now
  );

  if (!meta.isRetail) {
    return {
      isRetail: false,
      periodLabel: range.label,
      products: [],
      note: 'Top products are available for shop and pharmacy workspaces.',
    };
  }

  const shopClause = ctx.shopFilterId ? ' AND "Sale"."shopId" = :shopId' : '';
  const rows = await sequelize.query(
    `
    SELECT "SaleItem"."name" as "productName",
      SUM("SaleItem"."total") as "totalRevenue",
      SUM("SaleItem"."quantity") as "totalQuantity"
    FROM "sale_items" AS "SaleItem"
    INNER JOIN "sales" AS "Sale" ON "SaleItem"."saleId" = "Sale"."id"
    WHERE "Sale"."tenantId" = :tenantId
      AND "Sale"."status" = 'completed'
      AND "Sale"."deletedAt" IS NULL
      AND "Sale"."createdAt" BETWEEN :periodStart AND :periodEnd
      ${shopClause}
    GROUP BY "SaleItem"."name"
    ORDER BY SUM("SaleItem"."total") DESC
    LIMIT 8
    `,
    {
      replacements: {
        tenantId: ctx.tenantId,
        periodStart: range.start,
        periodEnd: range.end,
        ...(ctx.shopFilterId ? { shopId: ctx.shopFilterId } : {}),
      },
      type: sequelize.QueryTypes.SELECT,
    }
  );

  const products = (rows || []).map((row) => ({
    productName: row.productName,
    totalRevenue: roundMoney(row.totalRevenue),
    totalQuantity: Number(parseFloat(row.totalQuantity || 0)),
  }));

  return {
    isRetail: true,
    periodLabel: range.label,
    products,
  };
}

/**
 * Top product revenue for two periods (for sales-drop reasons).
 */
async function getTopProductCompare(ctx, currentRange, priorRange) {
  const meta = await resolveTenantMeta(ctx.tenantId);
  if (!meta.isRetail) {
    return { currentTop: null, priorTop: null };
  }

  const shopClause = ctx.shopFilterId ? ' AND "Sale"."shopId" = :shopId' : '';
  const fetchTop = async (start, end) => {
    const rows = await sequelize.query(
      `
      SELECT "SaleItem"."name" as "productName",
        SUM("SaleItem"."total") as "totalRevenue"
      FROM "sale_items" AS "SaleItem"
      INNER JOIN "sales" AS "Sale" ON "SaleItem"."saleId" = "Sale"."id"
      WHERE "Sale"."tenantId" = :tenantId
        AND "Sale"."status" = 'completed'
        AND "Sale"."deletedAt" IS NULL
        AND "Sale"."createdAt" BETWEEN :periodStart AND :periodEnd
        ${shopClause}
      GROUP BY "SaleItem"."name"
      ORDER BY SUM("SaleItem"."total") DESC
      LIMIT 1
      `,
      {
        replacements: {
          tenantId: ctx.tenantId,
          periodStart: start,
          periodEnd: end,
          ...(ctx.shopFilterId ? { shopId: ctx.shopFilterId } : {}),
        },
        type: sequelize.QueryTypes.SELECT,
      }
    );
    if (!rows?.[0]) return null;
    return {
      productName: rows[0].productName,
      totalRevenue: roundMoney(rows[0].totalRevenue),
    };
  };

  const [currentTop, priorTop] = await Promise.all([
    fetchTop(currentRange.start, currentRange.end),
    fetchTop(priorRange.start, priorRange.end),
  ]);

  // Same product name in both periods for decline check
  let currentSameAsPrior = null;
  if (priorTop?.productName) {
    const rows = await sequelize.query(
      `
      SELECT SUM("SaleItem"."total") as "totalRevenue"
      FROM "sale_items" AS "SaleItem"
      INNER JOIN "sales" AS "Sale" ON "SaleItem"."saleId" = "Sale"."id"
      WHERE "Sale"."tenantId" = :tenantId
        AND "Sale"."status" = 'completed'
        AND "Sale"."deletedAt" IS NULL
        AND "Sale"."createdAt" BETWEEN :periodStart AND :periodEnd
        AND "SaleItem"."name" = :productName
        ${shopClause}
      `,
      {
        replacements: {
          tenantId: ctx.tenantId,
          periodStart: currentRange.start,
          periodEnd: currentRange.end,
          productName: priorTop.productName,
          ...(ctx.shopFilterId ? { shopId: ctx.shopFilterId } : {}),
        },
        type: sequelize.QueryTypes.SELECT,
      }
    );
    currentSameAsPrior = {
      productName: priorTop.productName,
      totalRevenue: roundMoney(rows?.[0]?.totalRevenue),
    };
  }

  return { currentTop, priorTop, currentSameAsPrior };
}

module.exports = {
  getTopProducts,
  getTopProductCompare,
};
