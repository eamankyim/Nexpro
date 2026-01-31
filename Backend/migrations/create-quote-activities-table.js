const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');

const createQuoteActivitiesTable = async () => {
  console.log('🚀 Starting quote activities schema migration...');
  const transaction = await sequelize.transaction();

  try {
    console.log('🧱 Ensuring quote activity type enum exists...');
    await sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_quote_activities_type') THEN
          CREATE TYPE enum_quote_activities_type AS ENUM ('note', 'status_change', 'conversion');
        END IF;
      END
      $$;
    `, { transaction });

    console.log('📦 Creating quote_activities table if needed...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS quote_activities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" UUID NOT NULL REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE CASCADE,
        "quoteId" UUID NOT NULL REFERENCES quotes(id) ON UPDATE CASCADE ON DELETE CASCADE,
        type enum_quote_activities_type NOT NULL DEFAULT 'note',
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

    console.log('📊 Creating indexes for quote_activities...');
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS quote_activities_quote_idx ON quote_activities("quoteId");
    `, { transaction });
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS quote_activities_tenant_idx ON quote_activities("tenantId");
    `, { transaction });
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS quote_activities_created_by_idx ON quote_activities("createdBy");
    `, { transaction });
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS quote_activities_followup_idx ON quote_activities("followUpDate");
    `, { transaction });

    await transaction.commit();
    console.log('✅ Quote activities schema migration completed successfully!');
  } catch (error) {
    await transaction.rollback();
    console.error('💥 Quote activities schema migration failed:', error);
    throw error;
  }
};

if (require.main === module) {
  createQuoteActivitiesTable()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = createQuoteActivitiesTable;
