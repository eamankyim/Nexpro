const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize, testConnection } = require('../config/database');
const { QueryTypes } = require('sequelize');

/**
 * Makes dealers tenant-wide: one dealer list per organisation.
 * shopId remains nullable for legacy rows; ledger entries still tag branch.
 */
const makeDealersTenantWide = async (options = {}) => {
  const { closeConnection = true } = options;
  const isDirect = require.main === module;
  try {
    console.log('🔄 make-dealers-tenant-wide...');
    if (isDirect) await testConnection();

    const tables = await sequelize.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND lower(table_name) = 'dealers';`,
      { type: QueryTypes.SELECT }
    );
    if (tables.length === 0) {
      console.log('  ⚠️  dealers table not found; skipping.');
      return;
    }

    console.log('  ➡️  Making dealers.shopId nullable...');
    await sequelize.query(`
      ALTER TABLE dealers
      ALTER COLUMN "shopId" DROP NOT NULL;
    `);

    console.log('  ➡️  Updating dealer uniqueness to tenant-wide business name...');
    await sequelize.query(`
      DROP INDEX IF EXISTS uq_dealers_tenant_shop_business_name;
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_dealers_tenant_active ON dealers ("tenantId", "isActive");
    `);
    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_dealers_tenant_business_name
        ON dealers ("tenantId", "businessName");
    `).catch((err) => {
      if (err.message?.includes('duplicate key') || err.message?.includes('unique constraint')) {
        console.log('  ⚠️  Duplicate business names across branches — resolve manually before unique index applies.');
      } else {
        throw err;
      }
    });

    console.log('✅ make-dealers-tenant-wide completed.');
  } catch (error) {
    console.error('❌ make-dealers-tenant-wide failed:', error);
    throw error;
  } finally {
    if (closeConnection && isDirect) {
      await sequelize.close();
    }
  }
};

if (require.main === module) {
  makeDealersTenantWide().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = makeDealersTenantWide;
