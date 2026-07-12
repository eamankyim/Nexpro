const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize, testConnection } = require('../config/database');
const { QueryTypes } = require('sequelize');

/**
 * Adds custom-domain columns to online_store_settings for the "Online Store"
 * (customer-owned domain) product. Independent of the Sabito marketplace
 * `enabled` flag — a store can have a custom domain saved without being
 * listed in the Sabito marketplace, and vice versa.
 *
 * customDomain: nullable, globally unique host (e.g. "shop.myclient.com").
 * customDomainStatus: 'none' | 'pending' | 'verified'. DNS/SSL verification
 * is not automated yet — see Backend/controllers/storeController.js
 * (updateDomain) for the manual verification TODO.
 */
const addCustomDomainToOnlineStoreSettings = async () => {
  const isDirect = require.main === module;
  try {
    console.log('🔄 add-custom-domain-to-online-store-settings...\n');
    if (isDirect) await testConnection();

    const rows = await sequelize.query(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'online_store_settings' LIMIT 1`,
      { type: QueryTypes.SELECT }
    );
    if (!rows.length) {
      console.log('  ⏭️  Skipping online_store_settings (table does not exist)');
      if (isDirect) process.exit(0);
      return;
    }

    console.log('  ➡️  Adding online_store_settings.customDomain and .customDomainStatus...');
    await sequelize.query(`
      ALTER TABLE online_store_settings
      ADD COLUMN IF NOT EXISTS "customDomain" VARCHAR(255);
    `);
    await sequelize.query(`
      ALTER TABLE online_store_settings
      ADD COLUMN IF NOT EXISTS "customDomainStatus" VARCHAR(20) NOT NULL DEFAULT 'none';
    `);
    // Unique index: Postgres treats NULLs as distinct, so multiple tenants
    // without a custom domain is fine; only actual duplicate hostnames collide.
    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_online_store_settings_custom_domain
      ON online_store_settings ("customDomain");
    `);

    console.log('✅ add-custom-domain-to-online-store-settings completed.\n');
    if (isDirect) process.exit(0);
  } catch (error) {
    console.error('❌ add-custom-domain-to-online-store-settings failed:', error);
    if (isDirect) process.exit(1);
    throw error;
  }
};

if (require.main === module) {
  addCustomDomainToOnlineStoreSettings();
}

module.exports = addCustomDomainToOnlineStoreSettings;
