const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');

const createRecurringJournals = async ({ closeConnection = false } = {}) => {
  let transaction;
  try {
    transaction = await sequelize.transaction();

    await sequelize.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`, { transaction });

    await sequelize.query(
      `
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_recurring_journals_template_type') THEN
          CREATE TYPE "enum_recurring_journals_template_type" AS ENUM ('recurring_journal', 'prepaid_expense');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_recurring_journals_status') THEN
          CREATE TYPE "enum_recurring_journals_status" AS ENUM ('active', 'paused', 'completed');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_recurring_journals_frequency') THEN
          CREATE TYPE "enum_recurring_journals_frequency" AS ENUM ('weekly', 'monthly', 'quarterly', 'yearly');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_recurring_journal_runs_status') THEN
          CREATE TYPE "enum_recurring_journal_runs_status" AS ENUM ('success', 'failed', 'skipped');
        END IF;
      END$$;
      `,
      { transaction }
    );

    await sequelize.query(
      `
      CREATE TABLE IF NOT EXISTS recurring_journals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" UUID NOT NULL REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE CASCADE,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        "templateType" "enum_recurring_journals_template_type" NOT NULL DEFAULT 'recurring_journal',
        status "enum_recurring_journals_status" NOT NULL DEFAULT 'active',
        frequency "enum_recurring_journals_frequency" NOT NULL DEFAULT 'monthly',
        interval INTEGER NOT NULL DEFAULT 1,
        amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
        "debitAccountId" UUID NOT NULL REFERENCES accounts(id) ON UPDATE CASCADE ON DELETE RESTRICT,
        "creditAccountId" UUID NOT NULL REFERENCES accounts(id) ON UPDATE CASCADE ON DELETE RESTRICT,
        "startDate" DATE NOT NULL,
        "endDate" DATE,
        "nextRunDate" DATE NOT NULL,
        "lastRunDate" DATE,
        "autoPost" BOOLEAN NOT NULL DEFAULT true,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdBy" UUID REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      `,
      { transaction }
    );

    await sequelize.query(
      `
      CREATE TABLE IF NOT EXISTS recurring_journal_runs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" UUID NOT NULL REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE CASCADE,
        "recurringJournalId" UUID NOT NULL REFERENCES recurring_journals(id) ON UPDATE CASCADE ON DELETE CASCADE,
        "runDate" DATE NOT NULL,
        status "enum_recurring_journal_runs_status" NOT NULL DEFAULT 'success',
        "journalEntryId" UUID REFERENCES journal_entries(id) ON UPDATE CASCADE ON DELETE SET NULL,
        "errorMessage" TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE ("tenantId", "recurringJournalId", "runDate")
      );
      `,
      { transaction }
    );

    await sequelize.query(
      `CREATE INDEX IF NOT EXISTS idx_recurring_journals_tenant_next_run ON recurring_journals ("tenantId", status, "nextRunDate");`,
      { transaction }
    );

    await transaction.commit();
    console.log('✅ recurring_journals migration completed');
  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error('❌ recurring_journals migration failed:', error);
    throw error;
  } finally {
    if (closeConnection) await sequelize.close();
  }
};

if (require.main === module) {
  createRecurringJournals({ closeConnection: true })
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = createRecurringJournals;
