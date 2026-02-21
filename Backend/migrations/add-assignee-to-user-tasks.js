const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');

const addAssigneeToUserTasks = async () => {
  console.log('Adding assigneeId to user_tasks table...');
  const transaction = await sequelize.transaction();

  try {
    await sequelize.query(`
      ALTER TABLE IF EXISTS user_tasks
      ADD COLUMN IF NOT EXISTS "assigneeId" UUID REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;
    `, { transaction });

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS user_tasks_assignee_idx ON user_tasks("assigneeId");
    `, { transaction });

    await transaction.commit();
    console.log('assigneeId column added to user_tasks successfully.');
  } catch (error) {
    await transaction.rollback();
    console.error('Failed to add assigneeId to user_tasks:', error);
    throw error;
  }
};

if (require.main === module) {
  addAssigneeToUserTasks()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = addAssigneeToUserTasks;

