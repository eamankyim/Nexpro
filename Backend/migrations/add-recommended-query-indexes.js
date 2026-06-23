const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize, testConnection } = require('../config/database');

const INDEXES = [
  {
    table: 'expenses',
    name: 'idx_expenses_tenant_archived_expenseDate',
    createSql: `
      CREATE INDEX IF NOT EXISTS "idx_expenses_tenant_archived_expenseDate"
      ON expenses ("tenantId", "isArchived", "expenseDate" DESC);
    `,
  },
  {
    table: 'expenses',
    name: 'idx_expenses_tenant_archived_approvalStatus',
    createSql: `
      CREATE INDEX IF NOT EXISTS "idx_expenses_tenant_archived_approvalStatus"
      ON expenses ("tenantId", "isArchived", "approvalStatus");
    `,
  },
  {
    table: 'expenses',
    name: 'idx_expenses_tenant_archived_shop_expenseDate',
    createSql: `
      CREATE INDEX IF NOT EXISTS "idx_expenses_tenant_archived_shop_expenseDate"
      ON expenses ("tenantId", "isArchived", "shopId", "expenseDate" DESC);
    `,
  },
  {
    table: 'expenses',
    name: 'idx_expenses_tenant_archived_job_expenseDate',
    createSql: `
      CREATE INDEX IF NOT EXISTS "idx_expenses_tenant_archived_job_expenseDate"
      ON expenses ("tenantId", "isArchived", "jobId", "expenseDate" DESC);
    `,
  },
  {
    table: 'notifications',
    name: 'idx_notifications_tenant_user_read_createdAt',
    createSql: `
      CREATE INDEX IF NOT EXISTS "idx_notifications_tenant_user_read_createdAt"
      ON notifications ("tenantId", "userId", "isRead", "createdAt" DESC);
    `,
  },
  {
    table: 'products',
    name: 'idx_products_tenant_active_track_shop_quantity',
    createSql: `
      CREATE INDEX IF NOT EXISTS "idx_products_tenant_active_track_shop_quantity"
      ON products ("tenantId", "isActive", "trackStock", "shopId", "quantityOnHand", "reorderLevel");
    `,
  },
  {
    table: 'invoices',
    name: 'idx_invoices_tenant_studioLocation_createdAt',
    createSql: `
      CREATE INDEX IF NOT EXISTS "idx_invoices_tenant_studioLocation_createdAt"
      ON invoices ("tenantId", "studioLocationId", "createdAt" DESC);
    `,
  },
];

const isMissingRelationOrColumn = (error) => {
  const code = error?.parent?.code || error?.original?.code;
  const msg = String(error?.message || error?.parent?.message || '');
  return code === '42P01' || code === '42703' || /does not exist/i.test(msg);
};

const addRecommendedQueryIndexes = async (options = {}) => {
  const { closeConnection = false } = options;
  const isDirect = require.main === module;

  try {
    console.log('🔄 Adding recommended query indexes...\n');
    if (isDirect) await testConnection();

    for (const index of INDEXES) {
      try {
        await sequelize.query(index.createSql);
        console.log(`  ✅ ${index.name}`);
      } catch (error) {
        if (isMissingRelationOrColumn(error)) {
          console.log(`  ⚠️  Skipping ${index.name}; required table or column is missing`);
          continue;
        }
        throw error;
      }
    }

    console.log('\n✅ Recommended query indexes ready.\n');
  } catch (error) {
    console.error('\n❌ Recommended query index migration failed:', error);
    throw error;
  } finally {
    if (isDirect || closeConnection) {
      try { await sequelize.close(); } catch (_) { /* ignore */ }
    }
  }
};

const removeRecommendedQueryIndexes = async (queryInterface) => {
  const removeIndexSafe = async (index) => {
    try {
      if (queryInterface?.removeIndex) {
        await queryInterface.removeIndex(index.table, index.name);
        return;
      }
    } catch (_) {
      // Fall back to raw SQL; older Sequelize versions can require a table name.
    }

    await sequelize.query(`DROP INDEX IF EXISTS "${index.name}";`);
  };

  for (const index of [...INDEXES].reverse()) {
    await removeIndexSafe(index);
  }
};

addRecommendedQueryIndexes.up = addRecommendedQueryIndexes;
addRecommendedQueryIndexes.down = removeRecommendedQueryIndexes;
addRecommendedQueryIndexes.INDEXES = INDEXES;

if (require.main === module) {
  addRecommendedQueryIndexes({ closeConnection: true })
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = addRecommendedQueryIndexes;
