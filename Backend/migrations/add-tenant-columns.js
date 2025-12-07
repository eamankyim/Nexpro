const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');

const TABLES = [
  'customers',
  'vendors',
  'quotes',
  'quote_items',
  'jobs',
  'job_items',
  'invoices',
  'payments',
  'expenses',
  'leads',
  'lead_activities',
  'settings',
  'employees',
  'employee_documents',
  'employment_histories',
  'payroll_runs',
  'payroll_entries',
  'accounts',
  'journal_entries',
  'journal_entry_lines',
  'account_balances',
  'pricing_templates',
  'vendor_price_lists',
  'inventory_categories',
  'inventory_items',
  'inventory_movements',
  'job_status_history'
];

const CONSTRAINT_PREFIX = {
  customers: 'customers_tenant_fk',
  vendors: 'vendors_tenant_fk',
  quotes: 'quotes_tenant_fk',
  quote_items: 'quote_items_tenant_fk',
  jobs: 'jobs_tenant_fk',
  job_items: 'job_items_tenant_fk',
  invoices: 'invoices_tenant_fk',
  payments: 'payments_tenant_fk',
  expenses: 'expenses_tenant_fk',
  leads: 'leads_tenant_fk',
  lead_activities: 'lead_activities_tenant_fk',
  settings: 'settings_tenant_fk',
  employees: 'employees_tenant_fk',
  employee_documents: 'employee_documents_tenant_fk',
  employment_histories: 'employment_histories_tenant_fk',
  payroll_runs: 'payroll_runs_tenant_fk',
  payroll_entries: 'payroll_entries_tenant_fk',
  accounts: 'accounts_tenant_fk',
  journal_entries: 'journal_entries_tenant_fk',
  journal_entry_lines: 'journal_entry_lines_tenant_fk',
  account_balances: 'account_balances_tenant_fk',
  pricing_templates: 'pricing_templates_tenant_fk',
  vendor_price_lists: 'vendor_price_lists_tenant_fk',
  inventory_categories: 'inventory_categories_tenant_fk',
  inventory_items: 'inventory_items_tenant_fk',
  inventory_movements: 'inventory_movements_tenant_fk',
  job_status_history: 'job_status_history_tenant_fk'
};

const INDEX_PREFIX = {
  customers: 'customers_tenant_idx',
  vendors: 'vendors_tenant_idx',
  quotes: 'quotes_tenant_idx',
  quote_items: 'quote_items_tenant_idx',
  jobs: 'jobs_tenant_idx',
  job_items: 'job_items_tenant_idx',
  invoices: 'invoices_tenant_idx',
  payments: 'payments_tenant_idx',
  expenses: 'expenses_tenant_idx',
  leads: 'leads_tenant_idx',
  lead_activities: 'lead_activities_tenant_idx',
  settings: 'settings_tenant_idx',
  employees: 'employees_tenant_idx',
  employee_documents: 'employee_documents_tenant_idx',
  employment_histories: 'employment_histories_tenant_idx',
  payroll_runs: 'payroll_runs_tenant_idx',
  payroll_entries: 'payroll_entries_tenant_idx',
  accounts: 'accounts_tenant_idx',
  journal_entries: 'journal_entries_tenant_idx',
  journal_entry_lines: 'journal_entry_lines_tenant_idx',
  account_balances: 'account_balances_tenant_idx',
  pricing_templates: 'pricing_templates_tenant_idx',
  vendor_price_lists: 'vendor_price_lists_tenant_idx',
  inventory_categories: 'inventory_categories_tenant_idx',
  inventory_items: 'inventory_items_tenant_idx',
  inventory_movements: 'inventory_movements_tenant_idx',
  job_status_history: 'job_status_history_tenant_idx'
};

const UNIQUE_INDEX_ADJUSTMENTS = [
  {
    table: 'settings',
    dropConstraints: [],
    dropIndexes: ['settings_key_idx'],
    create: [
      `CREATE UNIQUE INDEX IF NOT EXISTS settings_tenant_key_idx ON settings("tenantId", key)`
    ]
  },
  {
    table: 'accounts',
    dropConstraints: ['accounts_code_key'],
    dropIndexes: [],
    create: [
      `CREATE UNIQUE INDEX IF NOT EXISTS accounts_tenant_code_idx ON accounts("tenantId", code)`
    ]
  },
  {
    table: 'inventory_categories',
    dropConstraints: ['inventory_categories_name_key'],
    dropIndexes: [],
    create: [
      `CREATE UNIQUE INDEX IF NOT EXISTS inventory_categories_tenant_name_idx ON inventory_categories("tenantId", name)`
    ]
  },
  {
    table: 'account_balances',
    dropConstraints: ['account_balances_account_id_fiscal_year_period_key'],
    dropIndexes: [],
    create: [
      `CREATE UNIQUE INDEX IF NOT EXISTS account_balances_tenant_account_period_idx ON account_balances("tenantId", "accountId", "fiscalYear", "period")`
    ]
  }
];

const ensureColumn = async (table, transaction) => {
  await sequelize.query(
    `ALTER TABLE ${table}
     ADD COLUMN IF NOT EXISTS "tenantId" UUID;`,
    { transaction }
  );
};

const backfillTenantId = async (table, tenantId, transaction) => {
  await sequelize.query(
    `UPDATE ${table}
     SET "tenantId" = :tenantId
     WHERE "tenantId" IS NULL;`,
    { transaction, replacements: { tenantId } }
  );
};

const enforceNotNull = async (table, transaction) => {
  await sequelize.query(
    `ALTER TABLE ${table}
     ALTER COLUMN "tenantId" SET NOT NULL;`,
    { transaction }
  );
};

const ensureConstraint = async (table, transaction) => {
  const constraintName = CONSTRAINT_PREFIX[table];
  if (!constraintName) return;

  await sequelize.query(
    `ALTER TABLE ${table}
     DROP CONSTRAINT IF EXISTS ${constraintName};`,
    { transaction }
  );

  await sequelize.query(
    `ALTER TABLE ${table}
     ADD CONSTRAINT ${constraintName}
     FOREIGN KEY ("tenantId") REFERENCES tenants(id)
     ON UPDATE CASCADE
     ON DELETE CASCADE;`,
    { transaction }
  );
};

const ensureIndex = async (table, transaction) => {
  const indexName = INDEX_PREFIX[table];
  if (!indexName) return;

  await sequelize.query(
    `CREATE INDEX IF NOT EXISTS ${indexName}
     ON ${table} ("tenantId");`,
    { transaction }
  );
};

const adjustUniqueIndexes = async (table, transaction) => {
  const adjustment = UNIQUE_INDEX_ADJUSTMENTS.find((item) => item.table === table);
  if (!adjustment) return;

  for (const constraintName of adjustment.dropConstraints || []) {
    await sequelize.query(
      `ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${constraintName};`,
      { transaction }
    );
  }

  for (const dropName of adjustment.dropIndexes || []) {
    await sequelize.query(
      `DROP INDEX IF EXISTS ${dropName};`,
      { transaction }
    );
  }

  for (const createSql of adjustment.create) {
    await sequelize.query(createSql, { transaction });
  }
};

const addTenantColumns = async () => {
  console.log('🏗️  Adding tenantId columns to core tables...');
  let transaction;

  try {
    transaction = await sequelize.transaction();

    const [tenantRows] = await sequelize.query(
      `SELECT id FROM tenants WHERE slug = 'default' LIMIT 1;`,
      { transaction }
    );

    let defaultTenantId = tenantRows?.[0]?.id;

    if (!defaultTenantId) {
      console.log('ℹ️ Default tenant missing. Creating one...');
      const trialEndDate = new Date();
      trialEndDate.setMonth(trialEndDate.getMonth() + 1);
      const [created] = await sequelize.query(
        `
          INSERT INTO tenants (name, slug, plan, status, metadata, "trialEndsAt")
          VALUES ('Default Tenant', 'default', 'trial', 'active', '{}'::jsonb, :trialEndDate)
          RETURNING id;
        `,
        { 
          transaction,
          replacements: { trialEndDate }
        }
      );
      defaultTenantId = created?.[0]?.id;
      console.log('✅ Default tenant created:', defaultTenantId);
    } else {
      // Fix existing default tenant if it's on trial but has no trialEndsAt
      await sequelize.query(
        `
          UPDATE tenants
          SET "trialEndsAt" = CASE
            WHEN "trialEndsAt" IS NULL AND plan = 'trial' 
            THEN COALESCE("createdAt", NOW()) + INTERVAL '1 month'
            ELSE "trialEndsAt"
          END
          WHERE id = :tenantId AND plan = 'trial' AND "trialEndsAt" IS NULL;
        `,
        {
          transaction,
          replacements: { tenantId: defaultTenantId }
        }
      );
    }

    for (const table of TABLES) {
      console.log(`➡️  Processing ${table}...`);
      await ensureColumn(table, transaction);
      await backfillTenantId(table, defaultTenantId, transaction);
      await enforceNotNull(table, transaction);
      await ensureConstraint(table, transaction);
      await ensureIndex(table, transaction);
      await adjustUniqueIndexes(table, transaction);
    }

    await transaction.commit();
    console.log('🎉 Tenant columns added successfully!');
  } catch (error) {
    if (transaction) {
      await transaction.rollback();
    }
    console.error('💥 Failed to add tenant columns:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
};

addTenantColumns();

