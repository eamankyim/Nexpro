const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');

/**
 * Migration: allow NULL tenantId in settings table so platform-wide
 * settings (platform:branding, platform:featureFlags, etc.) can use tenantId = NULL.
 */
const allowNullTenantIdInSettings = async () => {
  console.log('🔄 Updating settings.tenantId to allow NULL for platform settings...');

  try {
    await sequelize.query(
      `
        ALTER TABLE settings
        ALTER COLUMN "tenantId" DROP NOT NULL;
      `
    );

    console.log('✅ settings.tenantId now allows NULL.');
  } catch (error) {
    console.error('💥 Failed to update settings.tenantId nullability:', error);
    throw error;
  }
};

if (require.main === module) {
  allowNullTenantIdInSettings()
    .then(() => sequelize.close())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = allowNullTenantIdInSettings;
