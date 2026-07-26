const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize, testConnection } = require('../config/database');

/**
 * Adds templateId to online_store_settings for selectable Online Store layouts.
 */
const addTemplateIdToOnlineStoreSettings = async ({ closeConnection = true } = {}) => {
  const isDirect = require.main === module;
  try {
    console.log('[addTemplateIdToOnlineStoreSettings] Starting...');
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
        ADD COLUMN IF NOT EXISTS "templateId" VARCHAR(40) NOT NULL DEFAULT 'classic';
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_online_store_settings_template
      ON online_store_settings ("templateId");
    `);

    console.log('[addTemplateIdToOnlineStoreSettings] Done');
  } finally {
    if (closeConnection && isDirect) {
      await sequelize.close();
    }
  }
};

module.exports = addTemplateIdToOnlineStoreSettings;

if (require.main === module) {
  addTemplateIdToOnlineStoreSettings({ closeConnection: true })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
