const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');

/**
 * Staff POS / sales list filters by tenantId + soldBy + order by createdAt.
 */
const addSalesTenantSoldByCreatedIndex = async () => {
  const transaction = await sequelize.transaction();
  try {
    await sequelize.query(
      `CREATE INDEX IF NOT EXISTS "idx_sales_tenant_soldBy_createdAt" ON sales ("tenantId", "soldBy", "createdAt" DESC);`,
      { transaction }
    );
    await transaction.commit();
    console.log('[addSalesTenantSoldByCreatedIndex] Done');
  } catch (e) {
    await transaction.rollback();
    if (e?.message?.includes('does not exist')) {
      console.log('[addSalesTenantSoldByCreatedIndex] sales table missing, skip');
      return;
    }
    console.error('[addSalesTenantSoldByCreatedIndex] Failed', e);
    throw e;
  }
};

module.exports = addSalesTenantSoldByCreatedIndex;
