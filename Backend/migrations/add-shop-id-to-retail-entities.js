const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize, testConnection } = require('../config/database');
const { QueryTypes } = require('sequelize');

const TABLES = ['invoices', 'vendors', 'equipment', 'quotes', 'materials_items'];

const tableExists = async (table) => {
  const rows = await sequelize.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = :table
     LIMIT 1`,
    { replacements: { table }, type: QueryTypes.SELECT }
  );
  return rows.length > 0;
};

/**
 * Adds shopId to retail-scoped entities and backfills from linked sales or default shop.
 */
const addShopIdToRetailEntities = async () => {
  const isDirect = require.main === module;
  try {
    console.log('🔄 add-shop-id-to-retail-entities...\n');
    if (isDirect) await testConnection();

    const existingTables = [];
    for (const table of TABLES) {
      if (!(await tableExists(table))) {
        console.log(`  ⏭️  Skipping ${table} (table does not exist)`);
        continue;
      }
      existingTables.push(table);
      console.log(`  ➡️  Adding ${table}.shopId...`);
      await sequelize.query(`
        ALTER TABLE ${table}
        ADD COLUMN IF NOT EXISTS "shopId" UUID REFERENCES shops(id) ON UPDATE CASCADE ON DELETE SET NULL;
      `);
      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS ${table.replace(/[^a-z0-9_]/gi, '_')}_shop_idx ON ${table}("shopId");
      `);
    }

    if (existingTables.includes('invoices')) {
      console.log('  ➡️  Backfilling invoices.shopId from sales...');
      await sequelize.query(`
        UPDATE invoices i
        SET "shopId" = s."shopId"
        FROM sales s
        WHERE i."saleId" = s.id AND i."shopId" IS NULL AND s."shopId" IS NOT NULL;
      `);
    }

    for (const table of existingTables) {
      console.log(`  ➡️  Backfilling ${table}.shopId from default shop...`);
      await sequelize.query(`
        UPDATE ${table} t
        SET "shopId" = s.id
        FROM shops s
        WHERE t."tenantId" = s."tenantId"
          AND s."isDefault" = true
          AND t."shopId" IS NULL;
      `);
      await sequelize.query(`
        UPDATE ${table} t
        SET "shopId" = s.id
        FROM (
          SELECT DISTINCT ON ("tenantId") id, "tenantId"
          FROM shops
          WHERE "isActive" = true
          ORDER BY "tenantId", "isDefault" DESC, "createdAt" ASC
        ) s
        WHERE t."tenantId" = s."tenantId" AND t."shopId" IS NULL;
      `);
    }

    console.log('✅ add-shop-id-to-retail-entities completed.\n');
    if (isDirect) process.exit(0);
  } catch (error) {
    console.error('❌ add-shop-id-to-retail-entities failed:', error);
    if (isDirect) process.exit(1);
    throw error;
  }
};

if (require.main === module) {
  addShopIdToRetailEntities();
}

module.exports = addShopIdToRetailEntities;
