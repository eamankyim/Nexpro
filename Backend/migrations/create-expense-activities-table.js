const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');

const createExpenseActivitiesTable = async () => {
  console.log('🚀 Starting expense activities schema migration...');
  const transaction = await sequelize.transaction();

  try {
    console.log('🧱 Creating expense activity type enum...');
    await sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_expense_activities_type') THEN
          CREATE TYPE enum_expense_activities_type AS ENUM ('note', 'status_change', 'payment', 'approval', 'rejection', 'submission', 'update', 'creation');
        END IF;
      END
      $$;
    `, { transaction });

    console.log('📦 Creating expense_activities table if needed...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS expense_activities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" UUID NOT NULL REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE CASCADE,
        "expenseId" UUID NOT NULL REFERENCES expenses(id) ON UPDATE CASCADE ON DELETE CASCADE,
        type enum_expense_activities_type NOT NULL DEFAULT 'note',
        subject VARCHAR(255),
        notes TEXT,
        "createdBy" UUID REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `, { transaction });

    console.log('📊 Creating indexes for expense_activities...');
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS expense_activities_expense_idx ON expense_activities("expenseId");
    `, { transaction });
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS expense_activities_tenant_idx ON expense_activities("tenantId");
    `, { transaction });
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS expense_activities_created_by_idx ON expense_activities("createdBy");
    `, { transaction });
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS expense_activities_type_idx ON expense_activities(type);
    `, { transaction });

    await transaction.commit();
    console.log('✅ Expense activities schema migration completed successfully!');
  } catch (error) {
    await transaction.rollback();
    console.error('💥 Expense activities schema migration failed:', error);
    throw error;
  }
};

if (require.main === module) {
  createExpenseActivitiesTable()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = createExpenseActivitiesTable;
