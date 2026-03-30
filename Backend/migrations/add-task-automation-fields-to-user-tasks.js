const { sequelize } = require('../config/database');

module.exports = async function addTaskAutomationFieldsToUserTasks() {
  const qi = sequelize.getQueryInterface();
  const table = 'user_tasks';
  try {
    await qi.sequelize.query(`
      ALTER TABLE IF EXISTS ${table}
      ADD COLUMN IF NOT EXISTS "sourceType" VARCHAR(50),
      ADD COLUMN IF NOT EXISTS "sourceId" VARCHAR(120),
      ADD COLUMN IF NOT EXISTS "sourceEvent" VARCHAR(80),
      ADD COLUMN IF NOT EXISTS "dedupeKey" VARCHAR(255),
      ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;
    `);
    await qi.sequelize.query(`
      CREATE INDEX IF NOT EXISTS user_tasks_dedupe_idx
      ON ${table}("tenantId", "dedupeKey");
    `);
    console.log('✅ Added task automation fields to user_tasks');
  } catch (error) {
    console.error('❌ Failed to add task automation fields to user_tasks:', error.message);
    throw error;
  }
};

if (require.main === module) {
  module.exports()
    .then(async () => {
      try {
        await sequelize.close();
      } catch (_) {
        // ignore
      }
      process.exit(0);
    })
    .catch(async () => {
      try {
        await sequelize.close();
      } catch (_) {
        // ignore
      }
      process.exit(1);
    });
}
