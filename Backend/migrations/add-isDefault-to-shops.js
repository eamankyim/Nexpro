const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize, testConnection } = require('../config/database');

/**
 * Adds isDefault to shops (main branch from onboarding / signup).
 */
const addIsDefaultToShops = async () => {
  const isDirect = require.main === module;
  try {
    console.log('🔄 Adding isDefault column to shops...\n');
    if (isDirect) await testConnection();

    const [cols] = await sequelize.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'shops' AND column_name = 'isDefault';
    `);

    if (cols.length > 0) {
      console.log('✅ Column isDefault already exists on shops.');
    } else {
      await sequelize.query(`
        ALTER TABLE shops
        ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;
      `);
      console.log('✅ Column isDefault added to shops.');
    }

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS shops_tenant_default_idx
      ON shops ("tenantId")
      WHERE "isDefault" = true;
    `);

    console.log('✅ shops tenant default index ensured.\n');
    if (isDirect) process.exit(0);
  } catch (error) {
    console.error('❌ add-isDefault-to-shops failed:', error);
    if (isDirect) process.exit(1);
    throw error;
  }
};

module.exports = addIsDefaultToShops;

if (require.main === module) {
  addIsDefaultToShops();
}
