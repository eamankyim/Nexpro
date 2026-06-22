const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize, testConnection } = require('../config/database');
const { QueryTypes } = require('sequelize');

/**
 * Adds shopId to dealers so each branch maintains its own dealer list and balances.
 * Backfills existing rows with each tenant's default shop.
 */
const addShopIdToDealers = async (options = {}) => {
  const { closeConnection = true } = options;
  const isDirect = require.main === module;
  try {
    console.log('🔄 add-shop-id-to-dealers...');
    if (isDirect) await testConnection();

    const tables = await sequelize.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND lower(table_name) IN ('dealers', 'shops', 'tenants');`,
      { type: QueryTypes.SELECT }
    );
    const tableName = (row) =>
      String(row.table_name ?? row.TABLE_NAME ?? Object.values(row)[0] ?? '').toLowerCase();
    const names = new Set(tables.map(tableName));
    const hasDealers = names.has('dealers');
    const hasShops = names.has('shops');

    if (!hasDealers) {
      console.log('  ⚠️  dealers table not found; skipping.');
      return;
    }

    const shopIdColumn = await sequelize.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'dealers' AND column_name = 'shopId'
       LIMIT 1`,
      { type: QueryTypes.SELECT }
    );
    if (shopIdColumn.length > 0) {
      console.log('  ✅ dealers.shopId already exists; skipping add-shop-id-to-dealers.');
      return;
    }

    console.log('  ➡️  Adding dealers.shopId...');
    await sequelize.query(`
      ALTER TABLE dealers
      ADD COLUMN IF NOT EXISTS "shopId" UUID REFERENCES shops(id) ON UPDATE CASCADE ON DELETE CASCADE;
    `);

    if (hasShops) {
      console.log('  ➡️  Backfilling shopId from default shop per tenant...');
      await sequelize.query(`
        UPDATE dealers d
        SET "shopId" = s.id
        FROM shops s
        WHERE d."tenantId" = s."tenantId"
          AND s."isDefault" = true
          AND d."shopId" IS NULL;
      `);
      await sequelize.query(`
        UPDATE dealers d
        SET "shopId" = s.id
        FROM (
          SELECT DISTINCT ON ("tenantId") id, "tenantId"
          FROM shops
          WHERE "isActive" = true
          ORDER BY "tenantId", "isDefault" DESC, "createdAt" ASC
        ) s
        WHERE d."tenantId" = s."tenantId" AND d."shopId" IS NULL;
      `);
    }

    console.log('  ➡️  Enforcing NOT NULL and indexes...');
    await sequelize.query(`
      ALTER TABLE dealers
      ALTER COLUMN "shopId" SET NOT NULL;
    `).catch((err) => {
      if (err.message?.includes('contains null values')) {
        console.log('  ⚠️  dealers.shopId still has NULL rows; NOT NULL skipped until backfill completes.');
      } else {
        throw err;
      }
    });

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_dealers_tenant_shop ON dealers ("tenantId", "shopId");
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_dealers_tenant_shop_active ON dealers ("tenantId", "shopId", "isActive");
    `);
    await sequelize.query(`
      DROP INDEX IF EXISTS idx_dealers_tenant_active;
    `);
    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_dealers_tenant_shop_business_name
        ON dealers ("tenantId", "shopId", "businessName");
    `);

    console.log('✅ add-shop-id-to-dealers completed.');
  } catch (error) {
    console.error('❌ add-shop-id-to-dealers failed:', error);
    throw error;
  } finally {
    if (closeConnection && isDirect) {
      await sequelize.close();
    }
  }
};

if (require.main === module) {
  addShopIdToDealers().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = addShopIdToDealers;
