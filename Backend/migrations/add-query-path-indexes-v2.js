const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');

/**
 * Targeted indexes based on current list endpoint filters/orders:
 * - sales: tenant + orderStatus/shop + recency
 * - invoices: tenant + source/customer + recency
 * - jobs: tenant + createdBy + recency (used by staff invoice visibility helper)
 */
const addQueryPathIndexesV2 = async () => {
  const transaction = await sequelize.transaction();
  try {
    await sequelize.query(
      `CREATE INDEX IF NOT EXISTS "idx_sales_tenant_orderStatus_createdAt" ON sales ("tenantId", "orderStatus", "createdAt" DESC);`,
      { transaction }
    );
    await sequelize.query(
      `CREATE INDEX IF NOT EXISTS "idx_sales_tenant_shop_createdAt" ON sales ("tenantId", "shopId", "createdAt" DESC);`,
      { transaction }
    );
    await sequelize.query(
      `CREATE INDEX IF NOT EXISTS "idx_invoices_tenant_sourceType_createdAt" ON invoices ("tenantId", "sourceType", "createdAt" DESC);`,
      { transaction }
    );
    await sequelize.query(
      `CREATE INDEX IF NOT EXISTS "idx_invoices_tenant_customer_createdAt" ON invoices ("tenantId", "customerId", "createdAt" DESC);`,
      { transaction }
    );
    await sequelize.query(
      `CREATE INDEX IF NOT EXISTS "idx_jobs_tenant_createdBy_createdAt" ON jobs ("tenantId", "createdBy", "createdAt" DESC);`,
      { transaction }
    );

    await transaction.commit();
    console.log('[addQueryPathIndexesV2] Done');
  } catch (e) {
    await transaction.rollback();
    if (e?.message?.includes('does not exist')) {
      console.log('[addQueryPathIndexesV2] One or more tables missing, skip');
      return;
    }
    console.error('[addQueryPathIndexesV2] Failed', e);
    throw e;
  }
};

module.exports = addQueryPathIndexesV2;
