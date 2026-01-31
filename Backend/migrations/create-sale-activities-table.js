const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');

const createSaleActivitiesTable = async () => {
  console.log('🚀 Starting sale activities schema migration...');
  const transaction = await sequelize.transaction();

  try {
    console.log('🧱 Ensuring sale activity type enum exists...');
    await sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_sale_activities_type') THEN
          CREATE TYPE enum_sale_activities_type AS ENUM ('note', 'status_change', 'payment', 'refund');
        END IF;
      END
      $$;
    `, { transaction });

    console.log('📦 Creating sale_activities table if needed...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS sale_activities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" UUID NOT NULL REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE CASCADE,
        "saleId" UUID NOT NULL REFERENCES sales(id) ON UPDATE CASCADE ON DELETE CASCADE,
        type enum_sale_activities_type NOT NULL DEFAULT 'note',
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

    console.log('📊 Creating indexes for sale_activities...');
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS sale_activities_sale_idx ON sale_activities("saleId");
    `, { transaction });
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS sale_activities_tenant_idx ON sale_activities("tenantId");
    `, { transaction });
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS sale_activities_created_by_idx ON sale_activities("createdBy");
    `, { transaction });
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS sale_activities_followup_idx ON sale_activities("followUpDate");
    `, { transaction });

    await transaction.commit();
    console.log('✅ Sale activities schema migration completed successfully!');
  } catch (error) {
    await transaction.rollback();
    console.error('💥 Sale activities schema migration failed:', error);
    throw error;
  }
};

if (require.main === module) {
  createSaleActivitiesTable()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = createSaleActivitiesTable;
