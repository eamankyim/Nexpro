const { sequelize } = require('../config/database');

async function up() {
  try {
    console.log('🔄 Adding metadata column to jobs...');
    await sequelize.query(`
      ALTER TABLE IF EXISTS jobs
      ADD COLUMN IF NOT EXISTS "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb;
    `);
    console.log('✅ metadata column ready on jobs');
  } catch (error) {
    console.error('❌ add-metadata-to-jobs failed:', error);
    throw error;
  }
}

async function down() {
  try {
    await sequelize.query(`
      ALTER TABLE IF EXISTS jobs
      DROP COLUMN IF EXISTS "metadata";
    `);
  } catch (error) {
    console.error('❌ add-metadata-to-jobs down failed:', error);
    throw error;
  }
}

if (require.main === module) {
  up()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { up, down };
