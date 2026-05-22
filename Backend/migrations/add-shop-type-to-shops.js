const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize, testConnection } = require('../config/database');
const { QueryTypes } = require('sequelize');

/**
 * Per-shop retail flavor (supermarket, hardware, etc.) — separate businesses under one tenant.
 */
const addShopTypeToShops = async () => {
  const isDirect = require.main === module;
  try {
    console.log('🔄 add-shop-type-to-shops...\n');
    if (isDirect) await testConnection();

    const tables = await sequelize.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND lower(table_name) IN ('shops', 'tenants');`,
      { type: QueryTypes.SELECT }
    );
    const tableName = (row) =>
      String(row.table_name ?? row.TABLE_NAME ?? Object.values(row)[0] ?? '').toLowerCase();
    const names = new Set(tables.map(tableName));
    if (!names.has('shops')) {
      console.log('⏭️  shops table not found, skipping');
      if (isDirect) process.exit(0);
      return;
    }

    await sequelize.query(`
      ALTER TABLE shops
      ADD COLUMN IF NOT EXISTS "shopType" VARCHAR(50);
    `);

    if (names.has('tenants')) {
      console.log('  ➡️  Backfilling shopType from tenant metadata...');
      await sequelize.query(`
        UPDATE shops sh
        SET "shopType" = COALESCE(
          sh.metadata->>'shopType',
          (
            SELECT COALESCE(
              t.metadata->>'shopType',
              t.metadata->>'businessSubType'
            )
            FROM tenants t
            WHERE t.id = sh."tenantId"
          )
        )
        WHERE sh."shopType" IS NULL
          AND (
            sh.metadata->>'shopType' IS NOT NULL
            OR EXISTS (
              SELECT 1 FROM tenants t
              WHERE t.id = sh."tenantId"
                AND (
                  t.metadata->>'shopType' IS NOT NULL
                  OR t.metadata->>'businessSubType' IS NOT NULL
                )
            )
          );
      `);
    }

    console.log('✅ add-shop-type-to-shops completed.\n');
    if (isDirect) process.exit(0);
  } catch (error) {
    console.error('❌ add-shop-type-to-shops failed:', error);
    if (isDirect) process.exit(1);
    throw error;
  }
};

if (require.main === module) {
  addShopTypeToShops();
}

module.exports = addShopTypeToShops;
