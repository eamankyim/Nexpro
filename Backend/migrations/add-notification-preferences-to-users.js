const { sequelize } = require('../config/database');

/**
 * Per-user staff notification preferences (in-app bell + optional email copy).
 * Column name matches Sequelize camelCase convention used on users table.
 */
async function up() {
  try {
    console.log('🔄 Adding notificationPreferences to users...');
    await sequelize.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS "notificationPreferences" JSONB DEFAULT NULL;
    `);
    console.log('✅ notificationPreferences column ready');
  } catch (error) {
    console.error('❌ add-notification-preferences-to-users failed:', error);
    throw error;
  }
}

async function down() {
  try {
    await sequelize.query(`
      ALTER TABLE users
      DROP COLUMN IF EXISTS "notificationPreferences";
    `);
  } catch (error) {
    console.error('❌ add-notification-preferences-to-users down failed:', error);
    throw error;
  }
}

if (require.main === module) {
  up()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { up, down };
