const { sequelize } = require('../config/database');

async function tableExists(tableName) {
  const [rows] = await sequelize.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = :name LIMIT 1`,
    { replacements: { name: tableName } }
  );
  return Array.isArray(rows) && rows.length > 0;
}

module.exports = async function addShopIdToUserTasks() {
  const table = 'user_tasks';
  if (!(await tableExists(table))) {
    console.log('ℹ️  user_tasks table missing; skipping shopId column (run create-user-tasks-table first)');
    return;
  }

  await sequelize.query(`
    ALTER TABLE ${table}
    ADD COLUMN IF NOT EXISTS "shopId" UUID
    REFERENCES shops(id) ON UPDATE CASCADE ON DELETE SET NULL;
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS user_tasks_shop_idx
    ON ${table} ("shopId");
  `);
  console.log('✅ Added shopId to user_tasks');
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
    .catch(async (error) => {
      console.error('❌ Failed to add shopId to user_tasks:', error.message);
      try {
        await sequelize.close();
      } catch (_) {
        // ignore
      }
      process.exit(1);
    });
}
