const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');

const migrateJobStatusHistoryTenant = async () => {
  console.log('🧱 Ensuring job_status_history has tenantId column...');
  let transaction;

  try {
    transaction = await sequelize.transaction();

    await sequelize.query(
      `
        ALTER TABLE job_status_history
        ADD COLUMN IF NOT EXISTS "tenantId" UUID;
      `,
      { transaction }
    );

    const [tenantRows] = await sequelize.query(
      `SELECT id FROM tenants WHERE slug = 'default' LIMIT 1;`,
      { transaction }
    );

    const defaultTenantId = tenantRows?.[0]?.id;

    if (!defaultTenantId) {
      throw new Error('Default tenant is missing. Run create-tenants-schema migration first.');
    }

    await sequelize.query(
      `
        UPDATE job_status_history
        SET "tenantId" = :tenantId
        WHERE "tenantId" IS NULL;
      `,
      { transaction, replacements: { tenantId: defaultTenantId } }
    );

    await sequelize.query(
      `
        ALTER TABLE job_status_history
        ALTER COLUMN "tenantId" SET NOT NULL;
      `,
      { transaction }
    );

    await sequelize.query(
      `
        ALTER TABLE job_status_history
        DROP CONSTRAINT IF EXISTS job_status_history_tenant_fk;
      `,
      { transaction }
    );

    await sequelize.query(
      `
        ALTER TABLE job_status_history
        ADD CONSTRAINT job_status_history_tenant_fk
        FOREIGN KEY ("tenantId") REFERENCES tenants(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE;
      `,
      { transaction }
    );

    await sequelize.query(
      `
        CREATE INDEX IF NOT EXISTS job_status_history_tenant_idx
        ON job_status_history ("tenantId");
      `,
      { transaction }
    );

    await transaction.commit();
    console.log('✅ job_status_history tenant setup complete!');
  } catch (error) {
    if (transaction) {
      await transaction.rollback();
    }
    console.error('💥 Failed to update job_status_history with tenantId:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
};

migrateJobStatusHistoryTenant();


