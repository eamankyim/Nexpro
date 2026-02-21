const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');

const createUserChecklistsTables = async () => {
  console.log('Creating user_checklists and user_checklist_items tables...');
  const transaction = await sequelize.transaction();

  try {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS user_checklists (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" UUID NOT NULL REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE CASCADE,
        "userId" UUID NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `, { transaction });

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS user_checklist_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "checklistId" UUID NOT NULL REFERENCES user_checklists(id) ON UPDATE CASCADE ON DELETE CASCADE,
        "userId" UUID NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
        label VARCHAR(255) NOT NULL,
        done BOOLEAN NOT NULL DEFAULT false,
        "order" INTEGER NOT NULL DEFAULT 0,
        "isPrivate" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `, { transaction });

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS user_checklists_tenant_user_idx ON user_checklists("tenantId", "userId");
    `, { transaction });

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS user_checklist_items_checklist_idx ON user_checklist_items("checklistId");
    `, { transaction });

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS user_checklist_items_user_idx ON user_checklist_items("userId");
    `, { transaction });

    await transaction.commit();
    console.log('Checklist tables migration completed successfully.');
  } catch (error) {
    await transaction.rollback();
    console.error('Checklist tables migration failed:', error);
    throw error;
  }
};

if (require.main === module) {
  createUserChecklistsTables()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = createUserChecklistsTables;

