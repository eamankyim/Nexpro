const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize, testConnection } = require('../config/database');

/**
 * Adds secondaryColor and tertiaryColor to online_store_settings for template-driven brand colors.
 * Null means "use the active template's default for that slot".
 */
const addSecondaryTertiaryColorsToOnlineStoreSettings = async ({ closeConnection = true } = {}) => {
  const isDirect = require.main === module;
  try {
    console.log('[addSecondaryTertiaryColorsToOnlineStoreSettings] Starting...');
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
        ADD COLUMN IF NOT EXISTS "secondaryColor" VARCHAR(24) NULL,
        ADD COLUMN IF NOT EXISTS "tertiaryColor" VARCHAR(24) NULL;
    `);

    console.log('[addSecondaryTertiaryColorsToOnlineStoreSettings] Done');
  } finally {
    if (closeConnection && isDirect) {
      await sequelize.close();
    }
  }
};

module.exports = addSecondaryTertiaryColorsToOnlineStoreSettings;

if (require.main === module) {
  addSecondaryTertiaryColorsToOnlineStoreSettings({ closeConnection: true })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
