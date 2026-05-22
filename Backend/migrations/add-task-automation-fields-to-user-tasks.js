const { sequelize } = require('../config/database');

async function tableExists(tableName) {
  const [rows] = await sequelize.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = :name LIMIT 1`,
    { replacements: { name: tableName } }
  );
  return Array.isArray(rows) && rows.length > 0;
}

module.exports = async function addTaskAutomationFieldsToUserTasks() {
  const table = 'user_tasks';
  if (!(await tableExists(table))) {
    console.log('ℹ️  user_tasks table missing; skipping task automation fields (run create-user-tasks-table first)');
    return;
  }
  try {
    await sequelize.query(`
      ALTER TABLE ${table}
      ADD COLUMN IF NOT EXISTS "sourceType" VARCHAR(50),
      ADD COLUMN IF NOT EXISTS "sourceId" VARCHAR(120),
      ADD COLUMN IF NOT EXISTS "sourceEvent" VARCHAR(80),
      ADD COLUMN IF NOT EXISTS "dedupeKey" VARCHAR(255),
      ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;
    `);
    await sequelize.query(`
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
