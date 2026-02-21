const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');

const createUserWorkspaceTables = async () => {
  console.log('Creating user workspace tables...');
  const transaction = await sequelize.transaction();

  try {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS user_todos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        done BOOLEAN NOT NULL DEFAULT false,
        "dueDate" DATE,
        "sortOrder" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `, { transaction });

    await sequelize.query(`CREATE INDEX IF NOT EXISTS user_todos_user_id_idx ON user_todos("userId");`, { transaction });

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS user_week_focus (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "weekStart" DATE NOT NULL,
        items JSONB NOT NULL DEFAULT '[]'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `, { transaction });

    await sequelize.query(`CREATE INDEX IF NOT EXISTS user_week_focus_user_week_idx ON user_week_focus("userId", "weekStart");`, { transaction });
    await sequelize.query(`CREATE UNIQUE INDEX IF NOT EXISTS user_week_focus_user_week_unique ON user_week_focus("userId", "weekStart");`, { transaction });

    await transaction.commit();
    console.log('User workspace tables created successfully.');
  } catch (error) {
    await transaction.rollback();
    console.error('User workspace migration failed:', error);
    throw error;
  }
};

if (require.main === module) {
  createUserWorkspaceTables()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = createUserWorkspaceTables;
