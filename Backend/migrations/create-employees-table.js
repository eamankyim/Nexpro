const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');

const createEmployeesTables = async () => {
  console.log('🚀 Starting employees & payroll schema migration...');
  let transaction;

  try {
    console.log('🔐 Ensuring pgcrypto extension is available...');
    await sequelize.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    transaction = await sequelize.transaction();

    console.log('🧑‍🤝‍🧑 Creating employees table...');
    await sequelize.query(
      `
        CREATE TABLE IF NOT EXISTS employees (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "userId" UUID REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
          "firstName" VARCHAR(100) NOT NULL,
          "lastName" VARCHAR(100) NOT NULL,
          "middleName" VARCHAR(100),
          "preferredName" VARCHAR(100),
          email VARCHAR(150),
          phone VARCHAR(50),
          "jobTitle" VARCHAR(150),
          department VARCHAR(150),
          "employmentType" VARCHAR(20) NOT NULL DEFAULT 'full_time',
          status VARCHAR(20) NOT NULL DEFAULT 'active',
          "hireDate" DATE,
          "endDate" DATE,
          "salaryType" VARCHAR(20) NOT NULL DEFAULT 'salary',
          "salaryAmount" DECIMAL(12,2) DEFAULT 0,
          "payFrequency" VARCHAR(20) NOT NULL DEFAULT 'monthly',
          "bankName" VARCHAR(150),
          "bankAccountName" VARCHAR(150),
          "bankAccountNumber" VARCHAR(80),
          "emergencyContact" JSONB DEFAULT '{}'::jsonb,
          "nextOfKin" JSONB DEFAULT '{}'::jsonb,
          address JSONB DEFAULT '{}'::jsonb,
          metadata JSONB DEFAULT '{}'::jsonb,
          notes TEXT,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `,
      { transaction }
    );

    await sequelize.query(
      `
        ALTER TABLE employees
        ADD COLUMN IF NOT EXISTS "emergencyContact" JSONB DEFAULT '{}'::jsonb;
      `,
      { transaction }
    );

    await sequelize.query(
      `
        ALTER TABLE employees
        ADD COLUMN IF NOT EXISTS "nextOfKin" JSONB DEFAULT '{}'::jsonb;
      `,
      { transaction }
    );

    console.log('🗂️ Creating employee documents table...');
    await sequelize.query(
      `
        CREATE TABLE IF NOT EXISTS employee_documents (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "employeeId" UUID NOT NULL REFERENCES employees(id) ON UPDATE CASCADE ON DELETE CASCADE,
          type VARCHAR(50),
          title VARCHAR(200),
          "fileUrl" VARCHAR(500) NOT NULL,
          "uploadedBy" UUID REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
          metadata JSONB DEFAULT '{}'::jsonb,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `,
      { transaction }
    );

    console.log('📜 Creating employment history table...');
    await sequelize.query(
      `
        CREATE TABLE IF NOT EXISTS employment_histories (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "employeeId" UUID NOT NULL REFERENCES employees(id) ON UPDATE CASCADE ON DELETE CASCADE,
          "changeType" VARCHAR(50) NOT NULL,
          "effectiveDate" DATE NOT NULL,
          "fromValue" JSONB DEFAULT '{}'::jsonb,
          "toValue" JSONB DEFAULT '{}'::jsonb,
          notes TEXT,
          metadata JSONB DEFAULT '{}'::jsonb,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `,
      { transaction }
    );

    console.log('💼 Creating payroll runs table...');
    await sequelize.query(
      `
        CREATE TABLE IF NOT EXISTS payroll_runs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "periodStart" DATE NOT NULL,
          "periodEnd" DATE NOT NULL,
          "payDate" DATE NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'draft',
          "totalGross" DECIMAL(14,2) DEFAULT 0,
          "totalNet" DECIMAL(14,2) DEFAULT 0,
          "totalTax" DECIMAL(14,2) DEFAULT 0,
          "totalEmployees" INTEGER DEFAULT 0,
          "journalEntryId" UUID,
          notes TEXT,
          metadata JSONB DEFAULT '{}'::jsonb,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `,
      { transaction }
    );

    console.log('🧾 Creating payroll entries table...');
    await sequelize.query(
      `
        CREATE TABLE IF NOT EXISTS payroll_entries (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "payrollRunId" UUID NOT NULL REFERENCES payroll_runs(id) ON UPDATE CASCADE ON DELETE CASCADE,
          "employeeId" UUID NOT NULL REFERENCES employees(id) ON UPDATE CASCADE ON DELETE CASCADE,
          "grossPay" DECIMAL(12,2) DEFAULT 0,
          "netPay" DECIMAL(12,2) DEFAULT 0,
          allowances JSONB DEFAULT '[]'::jsonb,
          deductions JSONB DEFAULT '[]'::jsonb,
          taxes JSONB DEFAULT '[]'::jsonb,
          metadata JSONB DEFAULT '{}'::jsonb,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE("payrollRunId", "employeeId")
        );
      `,
      { transaction }
    );

    await transaction.commit();
    console.log('✅ Employees & payroll schema migration completed!');
  } catch (error) {
    if (transaction) {
      await transaction.rollback();
    }
    console.error('💥 Employees schema migration failed:', error);
    throw error;
  }
};

if (require.main === module) {
  createEmployeesTables()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = createEmployeesTables;

