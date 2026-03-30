const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');

const addJobQueryIndexes = async () => {
  const transaction = await sequelize.transaction();
  try {
    // Core filters/sorts used by GET /api/jobs
    await sequelize.query(
      `CREATE INDEX IF NOT EXISTS "idx_jobs_tenant_createdAt" ON jobs ("tenantId", "createdAt" DESC);`,
      { transaction }
    );
    await sequelize.query(
      `CREATE INDEX IF NOT EXISTS "idx_jobs_tenant_status_createdAt" ON jobs ("tenantId", "status", "createdAt" DESC);`,
      { transaction }
    );
    await sequelize.query(
      `CREATE INDEX IF NOT EXISTS "idx_jobs_tenant_customer_createdAt" ON jobs ("tenantId", "customerId", "createdAt" DESC);`,
      { transaction }
    );
    await sequelize.query(
      `CREATE INDEX IF NOT EXISTS "idx_jobs_tenant_priority_createdAt" ON jobs ("tenantId", "priority", "createdAt" DESC);`,
      { transaction }
    );
    await sequelize.query(
      `CREATE INDEX IF NOT EXISTS "idx_jobs_tenant_dueDate" ON jobs ("tenantId", "dueDate");`,
      { transaction }
    );
    await sequelize.query(
      `CREATE INDEX IF NOT EXISTS "idx_jobs_tenant_assignedTo_createdAt" ON jobs ("tenantId", "assignedTo", "createdAt" DESC);`,
      { transaction }
    );

    // Improve ILIKE '%search%' for jobNumber/title/description.
    await sequelize.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`, { transaction });
    await sequelize.query(
      `CREATE INDEX IF NOT EXISTS "idx_jobs_jobNumber_trgm" ON jobs USING gin ("jobNumber" gin_trgm_ops);`,
      { transaction }
    );
    await sequelize.query(
      `CREATE INDEX IF NOT EXISTS "idx_jobs_title_trgm" ON jobs USING gin ("title" gin_trgm_ops);`,
      { transaction }
    );
    await sequelize.query(
      `CREATE INDEX IF NOT EXISTS "idx_jobs_description_trgm" ON jobs USING gin ("description" gin_trgm_ops);`,
      { transaction }
    );

    await transaction.commit();
    console.log('[addJobQueryIndexes] Done');
  } catch (e) {
    await transaction.rollback();
    console.error('[addJobQueryIndexes] Failed', e);
    throw e;
  }
};

module.exports = addJobQueryIndexes;

