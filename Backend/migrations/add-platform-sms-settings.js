const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');
const { migrateLegacySmsSender } = require('../services/platformSmsSettingsService');

async function up(options = {}) {
  const { closeConnection = true } = options;
  try {
    console.log('🔄 Seeding platform:sms settings...');
    await sequelize.query(`
      INSERT INTO settings ("tenantId", key, value, description, "createdAt", "updatedAt")
      SELECT
        NULL,
        'platform:sms',
        '{"enabled":false,"provider":"arkesel","arkesel":{"senderId":"ABS"},"monthlyLimit":100}'::jsonb,
        'Platform SMS provider credentials (Arkesel)',
        NOW(),
        NOW()
      WHERE NOT EXISTS (
        SELECT 1 FROM settings WHERE "tenantId" IS NULL AND key = 'platform:sms'
      );
    `);
    await migrateLegacySmsSender();
    console.log('✅ platform:sms settings ready');
  } catch (error) {
    console.error('❌ add-platform-sms-settings failed:', error);
    throw error;
  } finally {
    if (closeConnection) {
      try { await sequelize.close(); } catch (_) { /* ignore */ }
    }
  }
}

async function down() {
  await sequelize.query(`DELETE FROM settings WHERE "tenantId" IS NULL AND key = 'platform:sms';`);
}

if (require.main === module) {
  up().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { up, down };
