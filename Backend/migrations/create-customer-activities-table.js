const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');

const createCustomerActivitiesTable = async () => {
  console.log('🚀 Starting customer activities schema migration...');
  const transaction = await sequelize.transaction();

  try {
    console.log('🧱 Ensuring customer activity type enum exists (reusing lead activities enum)...');
    await sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_lead_activities_type') THEN
          CREATE TYPE enum_lead_activities_type AS ENUM ('call', 'email', 'meeting', 'note', 'task');
        END IF;
      END
      $$;
    `, { transaction });

    console.log('📦 Creating customer_activities table if needed...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS customer_activities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "customerId" UUID NOT NULL REFERENCES customers(id) ON UPDATE CASCADE ON DELETE CASCADE,
        type enum_lead_activities_type NOT NULL DEFAULT 'note',
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
      CREATE INDEX IF NOT EXISTS customer_activities_created_by_idx ON customer_activities("createdBy");
    `, { transaction });
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS customer_activities_followup_idx ON customer_activities("followUpDate");
    `, { transaction });

    // Add tenantId column if it doesn't exist
    console.log('🏢 Adding tenantId column to customer_activities...');
    await sequelize.query(`
      ALTER TABLE customer_activities
      ADD COLUMN IF NOT EXISTS "tenantId" UUID;
    `, { transaction });

    // Backfill tenantId from customers table
    console.log('🔄 Backfilling tenantId from customers table...');
    await sequelize.query(`
      UPDATE customer_activities ca
      SET "tenantId" = c."tenantId"
      FROM customers c
      WHERE ca."customerId" = c.id AND ca."tenantId" IS NULL;
    `, { transaction });

    // Set tenantId to NOT NULL
    console.log('🔒 Setting tenantId to NOT NULL...');
    await sequelize.query(`
      ALTER TABLE customer_activities
      ALTER COLUMN "tenantId" SET NOT NULL;
    `, { transaction });

    // Add foreign key constraint
    console.log('🔗 Adding foreign key constraint for tenantId...');
    await sequelize.query(`
      ALTER TABLE customer_activities
      DROP CONSTRAINT IF EXISTS customer_activities_tenant_fk;
    `, { transaction });
    await sequelize.query(`
      ALTER TABLE customer_activities
      ADD CONSTRAINT customer_activities_tenant_fk
      FOREIGN KEY ("tenantId") REFERENCES tenants(id)
      ON UPDATE CASCADE
      ON DELETE CASCADE;
    `, { transaction });

    // Add index for tenantId
    console.log('📇 Creating index for tenantId...');
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS customer_activities_tenant_idx ON customer_activities("tenantId");
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
