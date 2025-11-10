const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');

const createLeadsTables = async () => {
  console.log('🚀 Starting leads schema migration...');
  const transaction = await sequelize.transaction();

  try {
    console.log('🧱 Ensuring lead status enum exists...');
    await sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_leads_status') THEN
          CREATE TYPE enum_leads_status AS ENUM ('new', 'contacted', 'qualified', 'lost', 'converted');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_leads_priority') THEN
          CREATE TYPE enum_leads_priority AS ENUM ('low', 'medium', 'high');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_lead_activities_type') THEN
          CREATE TYPE enum_lead_activities_type AS ENUM ('call', 'email', 'meeting', 'note', 'task');
        END IF;
      END
      $$;
    `, { transaction });

    console.log('📦 Creating leads table if needed...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS leads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        company VARCHAR(255),
        email VARCHAR(255),
        phone VARCHAR(100),
        source VARCHAR(255) DEFAULT 'unknown',
        status enum_leads_status NOT NULL DEFAULT 'new',
        priority enum_leads_priority NOT NULL DEFAULT 'medium',
        "assignedTo" UUID REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
        "nextFollowUp" TIMESTAMPTZ,
        "lastContactedAt" TIMESTAMPTZ,
        notes TEXT,
        tags TEXT[],
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "convertedCustomerId" UUID REFERENCES customers(id) ON UPDATE CASCADE ON DELETE SET NULL,
        "convertedJobId" UUID REFERENCES jobs(id) ON UPDATE CASCADE ON DELETE SET NULL,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `, { transaction });

    console.log('📦 Creating lead_activities table if needed...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS lead_activities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "leadId" UUID NOT NULL REFERENCES leads(id) ON UPDATE CASCADE ON DELETE CASCADE,
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

    console.log('📊 Creating indexes for leads...');
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS leads_status_idx ON leads(status);
    `, { transaction });
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS leads_assigned_idx ON leads("assignedTo");
    `, { transaction });
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS leads_followup_idx ON leads("nextFollowUp");
    `, { transaction });
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS lead_activities_lead_idx ON lead_activities("leadId");
    `, { transaction });

    await transaction.commit();
    console.log('✅ Leads schema migration completed successfully!');
  } catch (error) {
    await transaction.rollback();
    console.error('💥 Leads schema migration failed:', error);
    throw error;
  }
};

if (require.main === module) {
  createLeadsTables()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = createLeadsTables;




