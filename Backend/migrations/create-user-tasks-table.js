const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');

const createUserTasksTable = async () => {
  console.log('Creating user_tasks table for workspace tasks...');
  const transaction = await sequelize.transaction();

  try {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS user_tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" UUID NOT NULL REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE CASCADE,
        "userId" UUID NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'todo',
        "dueDate" DATE,
        priority VARCHAR(16),
        description TEXT,
        "isPrivate" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `, { transaction });

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS user_tasks_tenant_user_idx ON user_tasks("tenantId", "userId");
    `, { transaction });

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS user_tasks_status_idx ON user_tasks(status);
    `, { transaction });

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS user_tasks_due_date_idx ON user_tasks("dueDate");
    `, { transaction });

    await transaction.commit();
    console.log('user_tasks table migration completed successfully.');
  } catch (error) {
    await transaction.rollback();
    console.error('user_tasks table migration failed:', error);
    throw error;
  }
};

if (require.main === module) {
  createUserTasksTable()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = createUserTasksTable;

