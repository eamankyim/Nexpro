const { sequelize } = require('../config/database');

async function up() {
  try {
    console.log('🔄 Adding startDate column to user_tasks...');
    await sequelize.query(`
      ALTER TABLE IF EXISTS user_tasks
      ADD COLUMN IF NOT EXISTS "startDate" DATE;
    `);
    console.log('✅ startDate column ready on user_tasks');
  } catch (error) {
    console.error('❌ add-startDate-to-user-tasks failed:', error);
    throw error;
  }
}

async function down() {
  try {
    await sequelize.query(`
      ALTER TABLE IF EXISTS user_tasks
      DROP COLUMN IF EXISTS "startDate";
    `);
  } catch (error) {
    console.error('❌ add-startDate-to-user-tasks down failed:', error);
    throw error;
  }
}

if (require.main === module) {
  up()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { up, down };
