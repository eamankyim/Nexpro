const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize, testConnection } = require('../config/database');

/**
 * Online Store orders are Sale rows tagged with metadata.source = 'online_store'.
 * Keep the schema minimal and add expression/partial indexes for list, stats,
 * search, and fulfillment filters used by /api/store/orders.
 */
const addOnlineStoreOrderIndexes = async (options = {}) => {
  const { closeConnection = false } = options;
  const isDirect = require.main === module;
  try {
    console.log('🔄 Adding online store order indexes...\n');
    if (isDirect) await testConnection();

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS "idx_sales_online_store_tenant_createdAt"
      ON sales ("tenantId", "createdAt" DESC)
      WHERE metadata->>'source' = 'online_store';
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS "idx_sales_online_store_tenant_status_createdAt"
      ON sales ("tenantId", status, "createdAt" DESC)
      WHERE metadata->>'source' = 'online_store';
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS "idx_sales_online_store_tenant_delivery_createdAt"
      ON sales ("tenantId", "deliveryStatus", "createdAt" DESC)
      WHERE metadata->>'source' = 'online_store';
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS "idx_sales_online_store_tenant_order_status_createdAt"
      ON sales ("tenantId", "orderStatus", "createdAt" DESC)
      WHERE metadata->>'source' = 'online_store';
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS "idx_sales_online_store_tenant_shop_createdAt"
      ON sales ("tenantId", "shopId", "createdAt" DESC)
      WHERE metadata->>'source' = 'online_store';
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS "idx_sales_online_store_sale_number_search"
      ON sales USING gin ("saleNumber" gin_trgm_ops)
      WHERE metadata->>'source' = 'online_store';
    `).catch((error) => {
      if (String(error?.message || '').includes('gin_trgm_ops')) {
        console.log('[addOnlineStoreOrderIndexes] pg_trgm unavailable; skipping sale number trigram index');
        return;
      }
      throw error;
    });

    console.log('✅ Online store order indexes ready.\n');
  } catch (error) {
    console.error('\n❌ Online store order index migration failed:', error);
    throw error;
  } finally {
    if (isDirect || closeConnection) {
      try { await sequelize.close(); } catch (_) { /* ignore */ }
    }
  }
};

if (require.main === module) {
  addOnlineStoreOrderIndexes({ closeConnection: true })
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = addOnlineStoreOrderIndexes;
