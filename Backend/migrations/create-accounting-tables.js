const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');

const createAccountingTables = async () => {
  console.log('🚀 Starting accounting schema migration...');
  let transaction;

  try {
    console.log('🔐 Ensuring pgcrypto extension is available...');
    await sequelize.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    transaction = await sequelize.transaction();

    console.log('📚 Creating accounts table...');
    await sequelize.query(
      `
        CREATE TABLE IF NOT EXISTS accounts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          code VARCHAR(20) UNIQUE NOT NULL,
          name VARCHAR(200) NOT NULL,
          type VARCHAR(50) NOT NULL,
          category VARCHAR(50),
          "parentId" UUID REFERENCES accounts(id) ON UPDATE CASCADE ON DELETE SET NULL,
          description TEXT,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `,
      { transaction }
    );

    console.log('📄 Creating journal entries table...');
    await sequelize.query(
      `
        CREATE TABLE IF NOT EXISTS journal_entries (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          reference VARCHAR(100),
          description TEXT,
          "entryDate" DATE NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'draft',
          source VARCHAR(50),
          "sourceId" UUID,
          metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
          "createdBy" UUID REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
          "approvedBy" UUID REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `,
      { transaction }
    );

    console.log('🧾 Creating journal entry lines table...');
    await sequelize.query(
      `
        CREATE TABLE IF NOT EXISTS journal_entry_lines (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "journalEntryId" UUID NOT NULL REFERENCES journal_entries(id) ON UPDATE CASCADE ON DELETE CASCADE,
          "accountId" UUID NOT NULL REFERENCES accounts(id) ON UPDATE CASCADE ON DELETE RESTRICT,
          description TEXT,
          debit DECIMAL(14,2) NOT NULL DEFAULT 0,
          credit DECIMAL(14,2) NOT NULL DEFAULT 0,
          metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT chk_debit_credit CHECK (
            (debit = 0 AND credit >= 0) OR
            (credit = 0 AND debit >= 0)
          )
        );
      `,
      { transaction }
    );

    console.log('🔄 Ensuring journal entry status uses enum...');
    await sequelize.query(
      `
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_journal_entries_status') THEN
            CREATE TYPE "enum_journal_entries_status" AS ENUM ('draft', 'posted', 'void');
          END IF;
        END$$;
      `,
      { transaction }
    );

    await sequelize.query(
      `
        ALTER TABLE journal_entries
        ALTER COLUMN status DROP DEFAULT;
      `,
      { transaction }
    );

    await sequelize.query(
      `
        ALTER TABLE journal_entries
        ALTER COLUMN status TYPE "enum_journal_entries_status"
        USING status::text::"enum_journal_entries_status";
      `,
      { transaction }
    );

    await sequelize.query(
      `
        ALTER TABLE journal_entries
        ALTER COLUMN status SET DEFAULT 'draft';
      `,
      { transaction }
    );

    console.log('💼 Seeding default chart of accounts...');
    await sequelize.query(
      `
        INSERT INTO accounts (id, code, name, type, category, "createdAt", "updatedAt")
        VALUES
          (gen_random_uuid(), '1100', 'Accounts Receivable', 'asset', 'current_asset', NOW(), NOW()),
          (gen_random_uuid(), '1000', 'Cash and Bank', 'asset', 'current_asset', NOW(), NOW()),
          (gen_random_uuid(), '1200', 'Undeposited Funds', 'asset', 'current_asset', NOW(), NOW()),
          (gen_random_uuid(), '2000', 'Payroll Payable', 'liability', 'current_liability', NOW(), NOW()),
          (gen_random_uuid(), '2100', 'Payroll Taxes Payable', 'liability', 'current_liability', NOW(), NOW()),
          (gen_random_uuid(), '2200', 'Employer Contributions Payable', 'liability', 'current_liability', NOW(), NOW()),
          (gen_random_uuid(), '4000', 'Sales Revenue', 'income', 'operating_income', NOW(), NOW()),
          (gen_random_uuid(), '5000', 'Salaries Expense', 'expense', 'operating_expense', NOW(), NOW()),
          (gen_random_uuid(), '5100', 'Employer Contributions Expense', 'expense', 'operating_expense', NOW(), NOW())
        ON CONFLICT (code) DO NOTHING;
      `,
      { transaction }
    );

    console.log('📊 Creating account balances table...');
    await sequelize.query(
      `
        CREATE TABLE IF NOT EXISTS account_balances (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "accountId" UUID NOT NULL REFERENCES accounts(id) ON UPDATE CASCADE ON DELETE CASCADE,
          "fiscalYear" INTEGER NOT NULL,
          period INTEGER NOT NULL,
          debit DECIMAL(14,2) NOT NULL DEFAULT 0,
          credit DECIMAL(14,2) NOT NULL DEFAULT 0,
          balance DECIMAL(14,2) NOT NULL DEFAULT 0,
          metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE("accountId", "fiscalYear", period)
        );
      `,
      { transaction }
    );

    await transaction.commit();
    console.log('✅ Accounting schema migration completed!');
  } catch (error) {
    if (transaction) {
      await transaction.rollback();
    }
    console.error('💥 Accounting schema migration failed:', error);
    throw error;
  }
};

if (require.main === module) {
  createAccountingTables()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = createAccountingTables;

