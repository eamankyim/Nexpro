const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');

const TABLE_CONFIG = [
  {
    table: 'notifications',
    constraint: 'notifications_tenant_fk',
    index: 'notifications_tenant_idx',
  },
  {
    table: 'invite_tokens',
    constraint: 'invite_tokens_tenant_fk',
    index: 'invite_tokens_tenant_idx',
  },
];

const addTenantColumn = async (table, transaction) => {
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

const ensureConstraint = async ({ table, constraint }, transaction) => {
  await sequelize.query(
    `ALTER TABLE ${table}
     DROP CONSTRAINT IF EXISTS ${constraint};`,
    { transaction }
  );

  await sequelize.query(
    `ALTER TABLE ${table}
     ADD CONSTRAINT ${constraint}
     FOREIGN KEY ("tenantId") REFERENCES tenants(id)
     ON UPDATE CASCADE
     ON DELETE CASCADE;`,
    { transaction }
  );
};

const ensureIndex = async ({ table, index }, transaction) => {
  await sequelize.query(
    `CREATE INDEX IF NOT EXISTS ${index}
     ON ${table} ("tenantId");`,
    { transaction }
  );
};

const addTenantColumnsToNotificationsAndInvites = async () => {
  console.log('🏗️  Adding tenantId to notifications and invite tokens...');
  let transaction;

  try {
    transaction = await sequelize.transaction();

    const [tenantRows] = await sequelize.query(
      `SELECT id FROM tenants WHERE slug = 'default' LIMIT 1;`,
      { transaction }
    );

    let defaultTenantId = tenantRows?.[0]?.id;

    if (!defaultTenantId) {
      console.log('ℹ️ Default tenant not found. Creating one...');
      const [created] = await sequelize.query(
        `
          INSERT INTO tenants (name, slug, plan, status, metadata)
          VALUES ('Default Tenant', 'default', 'trial', 'active', '{}'::jsonb)
          RETURNING id;
        `,
        { transaction }
      );
      defaultTenantId = created?.[0]?.id;
      console.log('✅ Default tenant created:', defaultTenantId);
    }

    for (const config of TABLE_CONFIG) {
      console.log(`➡️  Processing ${config.table}...`);
      await addTenantColumn(config.table, transaction);
      await backfillTenantId(config.table, defaultTenantId, transaction);
      await enforceNotNull(config.table, transaction);
      await ensureConstraint(config, transaction);
      await ensureIndex(config, transaction);
    }

    await transaction.commit();
    console.log('🎉 Tenant columns added to notifications and invite tokens!');
  } catch (error) {
    if (transaction) {
      await transaction.rollback();
    }
    console.error('💥 Failed to add tenant columns to notifications/invite tokens:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
};

addTenantColumnsToNotificationsAndInvites();


