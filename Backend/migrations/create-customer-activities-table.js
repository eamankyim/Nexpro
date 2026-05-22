const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');

const createCustomerActivitiesTable = async () => {
  console.log('🚀 Starting customer activities schema migration...');
  const transaction = await sequelize.transaction();

  try {
    console.log('🧱 Ensuring customer activity type enum exists...');
    await sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_customer_activities_type') THEN
          CREATE TYPE enum_customer_activities_type AS ENUM ('call', 'email', 'meeting', 'note', 'task');
        END IF;
      END
      $$;
    `, { transaction });

    console.log('📦 Creating customer_activities table if needed...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS customer_activities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" UUID NOT NULL REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE CASCADE,
        "customerId" UUID NOT NULL REFERENCES customers(id) ON UPDATE CASCADE ON DELETE CASCADE,
        type enum_customer_activities_type NOT NULL DEFAULT 'note',
        subject VARCHAR(255),
        notes TEXT,
        "createdBy" UUID REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
        "nextStep" VARCHAR(255),
        "followUpDate" TIMESTAMPTZ,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `, { transaction });

    console.log('📊 Creating indexes for customer_activities...');
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS customer_activities_customer_idx ON customer_activities("customerId");
    `, { transaction });
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS customer_activities_tenant_idx ON customer_activities("tenantId");
    `, { transaction });
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS customer_activities_created_by_idx ON customer_activities("createdBy");
    `, { transaction });
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS customer_activities_followup_idx ON customer_activities("followUpDate");
    `, { transaction });

    await transaction.commit();
    console.log('✅ Customer activities schema migration completed successfully!');
  } catch (error) {
    await transaction.rollback();
    console.error('💥 Customer activities schema migration failed:', error);
    throw error;
  }
};

if (require.main === module) {
  createCustomerActivitiesTable()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = createCustomerActivitiesTable;
