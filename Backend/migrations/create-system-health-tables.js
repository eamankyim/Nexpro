const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');

/**
 * Create delivery_events + system_health_issues for platform System Health alerts.
 * @param {{ closeConnection?: boolean }} [options]
 */
const createSystemHealthTables = async (options = {}) => {
  const { closeConnection = true } = options;
  console.log('Starting system health tables migration...');
  const transaction = await sequelize.transaction();

  try {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS delivery_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" UUID NULL REFERENCES tenants(id) ON DELETE SET NULL ON UPDATE CASCADE,
        channel VARCHAR(20) NOT NULL,
        provider VARCHAR(60) NULL,
        source VARCHAR(80) NULL,
        status VARCHAR(20) NOT NULL,
        "errorCode" VARCHAR(80) NULL,
        "errorMessage" TEXT NULL,
        "recipientMasked" VARCHAR(120) NULL,
        "subjectOrContext" VARCHAR(255) NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `, { transaction });

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS delivery_events_created_at_idx
        ON delivery_events ("createdAt" DESC);
    `, { transaction });

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS delivery_events_status_created_idx
        ON delivery_events (status, "createdAt" DESC);
    `, { transaction });

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS delivery_events_channel_created_idx
        ON delivery_events (channel, "createdAt" DESC);
    `, { transaction });

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS delivery_events_tenant_created_idx
        ON delivery_events ("tenantId", "createdAt" DESC);
    `, { transaction });

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS system_health_issues (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        fingerprint VARCHAR(255) NOT NULL,
        severity VARCHAR(20) NOT NULL DEFAULT 'warning',
        category VARCHAR(40) NOT NULL,
        title VARCHAR(255) NOT NULL,
        summary TEXT NULL,
        "tenantId" UUID NULL REFERENCES tenants(id) ON DELETE SET NULL ON UPDATE CASCADE,
        status VARCHAR(20) NOT NULL DEFAULT 'open',
        "firstSeenAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "lastSeenAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
        "lastErrorMessage" TEXT NULL,
        "notifiedAt" TIMESTAMP WITH TIME ZONE NULL,
        "resolvedAt" TIMESTAMP WITH TIME ZONE NULL,
        "acknowledgedAt" TIMESTAMP WITH TIME ZONE NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        CONSTRAINT system_health_issues_fingerprint_unique UNIQUE (fingerprint)
      );
    `, { transaction });

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS system_health_issues_status_severity_idx
        ON system_health_issues (status, severity);
    `, { transaction });

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS system_health_issues_last_seen_idx
        ON system_health_issues ("lastSeenAt" DESC);
    `, { transaction });

    await transaction.commit();
    console.log('System health tables migration completed.');
  } catch (error) {
    await transaction.rollback();
    console.error('System health tables migration failed:', error);
    throw error;
  } finally {
    if (closeConnection) {
      await sequelize.close().catch(() => {});
    }
  }
};

if (require.main === module) {
  createSystemHealthTables()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

module.exports = createSystemHealthTables;
module.exports.up = createSystemHealthTables;
