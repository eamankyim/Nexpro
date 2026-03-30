const { sequelize } = require('../config/database');

async function up() {
  try {
    console.log('🔄 Adding metadata column to user_tasks...');
    await sequelize.query(`
      ALTER TABLE IF EXISTS user_tasks
      ADD COLUMN IF NOT EXISTS "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb;
    `);
    console.log('✅ metadata column ready on user_tasks');
  } catch (error) {
    console.error('❌ add-metadata-to-user-tasks failed:', error);
    throw error;
  }
}

async function down() {
  try {
    await sequelize.query(`
      ALTER TABLE IF EXISTS user_tasks
      DROP COLUMN IF EXISTS "metadata";
    `);
  } catch (error) {
    console.error('❌ add-metadata-to-user-tasks down failed:', error);
    throw error;
  }
}

if (require.main === module) {
  up()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { up, down };
