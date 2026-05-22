const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize, testConnection } = require('../config/database');
const { QueryTypes } = require('sequelize');

/**
 * Adds shopId to expenses for per-shop P&amp;L and expense lists in retail workspaces.
 */
const addShopIdToExpenses = async () => {
  const isDirect = require.main === module;
  try {
    console.log('🔄 add-shop-id-to-expenses...\n');
    if (isDirect) await testConnection();

    const tables = await sequelize.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND lower(table_name) IN ('expenses', 'shops');`,
      { type: QueryTypes.SELECT }
    );
    const tableName = (row) =>
      String(row?.table_name ?? row?.TABLE_NAME ?? (Array.isArray(row) ? row[0] : Object.values(row ?? {})[0]) ?? '').toLowerCase();
    const names = new Set(tables.map(tableName));
    if (!names.has('expenses')) {
      console.log('  ⚠️  expenses not listed in information_schema; attempting ALTER anyway...');
    }

    console.log('  ➡️  Adding expenses.shopId...');
    await sequelize.query(`
      ALTER TABLE expenses
      ADD COLUMN IF NOT EXISTS "shopId" UUID REFERENCES shops(id) ON UPDATE CASCADE ON DELETE SET NULL;
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS expenses_shop_idx ON expenses("shopId");
    `);

    if (names.has('shops')) {
      console.log('  ➡️  Backfilling expenses.shopId from default shop...');
      await sequelize.query(`
        UPDATE expenses e
        SET "shopId" = s.id
        FROM shops s
        WHERE e."tenantId" = s."tenantId" AND s."isDefault" = true AND e."shopId" IS NULL;
      `);
      await sequelize.query(`
        UPDATE expenses e
        SET "shopId" = s.id
        FROM (
          SELECT DISTINCT ON ("tenantId") id, "tenantId"
          FROM shops WHERE "isActive" = true
          ORDER BY "tenantId", "isDefault" DESC, "createdAt" ASC
        ) s
        WHERE e."tenantId" = s."tenantId" AND e."shopId" IS NULL;
      `);
    }

    console.log('✅ add-shop-id-to-expenses completed.\n');
    if (isDirect) process.exit(0);
  } catch (error) {
    console.error('❌ add-shop-id-to-expenses failed:', error);
    if (isDirect) process.exit(1);
    throw error;
  }
};

if (require.main === module) {
  addShopIdToExpenses();
}

module.exports = addShopIdToExpenses;
