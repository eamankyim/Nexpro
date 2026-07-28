const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize, testConnection } = require('../config/database');

/**
 * Adds listedOnMarketplace so Online Store can be live (enabled) without
 * appearing on Sabito marketplace discovery.
 */
const addListedOnMarketplaceToOnlineStoreSettings = async ({ closeConnection = true } = {}) => {
  const isDirect = require.main === module;
  try {
    console.log('[addListedOnMarketplaceToOnlineStoreSettings] Starting...');
    if (isDirect) await testConnection();

    const [tables] = await sequelize.query(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'online_store_settings' LIMIT 1`
    );
    if (!tables.length) {
      console.log('  Skipping online_store_settings (table does not exist)');
      return;
    }

    await sequelize.query(`
      ALTER TABLE online_store_settings
        ADD COLUMN IF NOT EXISTS "listedOnMarketplace" BOOLEAN NOT NULL DEFAULT FALSE;
    `);
    await sequelize.query(`
      UPDATE online_store_settings
      SET "listedOnMarketplace" = TRUE
      WHERE enabled = TRUE AND "listedOnMarketplace" = FALSE;
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS online_store_settings_listed_on_marketplace_idx
      ON online_store_settings ("listedOnMarketplace");
    `);

    console.log('[addListedOnMarketplaceToOnlineStoreSettings] Done.');
  } catch (error) {
    console.error('[addListedOnMarketplaceToOnlineStoreSettings] Failed:', error.message);
    throw error;
  } finally {
    if (isDirect && closeConnection) {
      await sequelize.close();
    }
  }
};

module.exports = addListedOnMarketplaceToOnlineStoreSettings;

if (require.main === module) {
  addListedOnMarketplaceToOnlineStoreSettings()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
