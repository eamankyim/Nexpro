const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize, testConnection } = require('../config/database');
const { QueryTypes } = require('sequelize');

/**
 * Adds shopId to customers for retail multi-shop workspaces.
 * Backfills existing rows with each tenant's default shop.
 */
const addShopIdToCustomers = async () => {
  const isDirect = require.main === module;
  try {
    console.log('🔄 add-shop-id-to-customers...\n');
    if (isDirect) await testConnection();

    const tables = await sequelize.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND lower(table_name) IN ('customers', 'shops', 'tenants');`,
      { type: QueryTypes.SELECT }
    );
    const tableName = (row) =>
      String(row.table_name ?? row.TABLE_NAME ?? Object.values(row)[0] ?? '').toLowerCase();
    const names = new Set(tables.map(tableName));
    const hasCustomers = names.has('customers');
    const hasShops = names.has('shops');
    const hasTenants = names.has('tenants');

    if (!hasCustomers) {
      console.log('  ⚠️  customers not listed in information_schema; attempting ALTER anyway...');
    }

    console.log('  ➡️  Adding customers.shopId...');
    await sequelize.query(`
      ALTER TABLE customers
      ADD COLUMN IF NOT EXISTS "shopId" UUID REFERENCES shops(id) ON UPDATE CASCADE ON DELETE SET NULL;
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS customers_shop_idx ON customers("shopId");
    `);

    if (hasShops || hasTenants) {
      console.log('  ➡️  Backfilling shopId from default shop per tenant...');
      await sequelize.query(`
        UPDATE customers c
        SET "shopId" = s.id
        FROM shops s
        WHERE c."tenantId" = s."tenantId"
          AND s."isDefault" = true
          AND c."shopId" IS NULL;
      `);
      await sequelize.query(`
        UPDATE customers c
        SET "shopId" = s.id
        FROM (
          SELECT DISTINCT ON ("tenantId") id, "tenantId"
          FROM shops
          WHERE "isActive" = true
          ORDER BY "tenantId", "isDefault" DESC, "createdAt" ASC
        ) s
        WHERE c."tenantId" = s."tenantId" AND c."shopId" IS NULL;
      `);
    }

    console.log('✅ add-shop-id-to-customers completed.\n');
    if (isDirect) process.exit(0);
  } catch (error) {
    console.error('❌ add-shop-id-to-customers failed:', error);
    if (isDirect) process.exit(1);
    throw error;
  }
};

if (require.main === module) {
  addShopIdToCustomers();
}

module.exports = addShopIdToCustomers;
