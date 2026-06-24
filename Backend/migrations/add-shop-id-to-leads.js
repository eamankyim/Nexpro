const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize, testConnection } = require('../config/database');
const { QueryTypes } = require('sequelize');

/**
 * Adds shopId to leads for retail multi-shop workspaces.
 * Backfills existing shop/pharmacy tenant leads with each tenant's default shop.
 */
const addShopIdToLeads = async () => {
  const isDirect = require.main === module;
  try {
    console.log('🔄 add-shop-id-to-leads...\n');
    if (isDirect) await testConnection();

    const rows = await sequelize.query(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'leads' LIMIT 1`,
      { type: QueryTypes.SELECT }
    );
    if (!rows.length) {
      console.log('  ⏭️  Skipping leads (table does not exist)');
      if (isDirect) process.exit(0);
      return;
    }

    console.log('  ➡️  Adding leads.shopId...');
    await sequelize.query(`
      ALTER TABLE leads
      ADD COLUMN IF NOT EXISTS "shopId" UUID REFERENCES shops(id) ON UPDATE CASCADE ON DELETE SET NULL;
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS leads_shop_idx ON leads("shopId");
    `);

    console.log('  ➡️  Backfilling shopId for shop/pharmacy tenant leads...');
    // PostgreSQL UPDATE...FROM cannot reference the target table (leads) inside FROM joins.
    await sequelize.query(`
      UPDATE leads
      SET "shopId" = s.id
      FROM shops s
      INNER JOIN tenants t ON t."id" = s."tenantId"
      WHERE leads."tenantId" = s."tenantId"
        AND s."isDefault" = true
        AND leads."shopId" IS NULL
        AND t."businessType" IN ('shop', 'pharmacy');
    `);
    await sequelize.query(`
      UPDATE leads
      SET "shopId" = s.id
      FROM (
        SELECT DISTINCT ON ("tenantId") id, "tenantId"
        FROM shops
        WHERE "isActive" = true
        ORDER BY "tenantId", "isDefault" DESC, "createdAt" ASC
      ) s
      INNER JOIN tenants t ON t."id" = s."tenantId"
      WHERE leads."tenantId" = s."tenantId"
        AND leads."shopId" IS NULL
        AND t."businessType" IN ('shop', 'pharmacy');
    `);

    console.log('✅ add-shop-id-to-leads completed.\n');
    if (isDirect) process.exit(0);
  } catch (error) {
    console.error('❌ add-shop-id-to-leads failed:', error);
    if (isDirect) process.exit(1);
    throw error;
  }
};

if (require.main === module) {
  addShopIdToLeads();
}

module.exports = addShopIdToLeads;
