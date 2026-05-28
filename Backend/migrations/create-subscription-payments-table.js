const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize, testConnection } = require('../config/database');

const quoteIdent = (identifier) => {
  if (!/^[a-z][a-z0-9_]*$/i.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }
  return `"${identifier}"`;
};

const createSubscriptionPaymentsTable = async ({ closeConnection = true } = {}) => {
  const isDirect = require.main === module;
  try {
    console.log('create-subscription-payments-table...');
    if (isDirect) await testConnection();

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS ${quoteIdent('subscription_payments')} (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        plan VARCHAR(50) NOT NULL,
        "billingPeriod" VARCHAR(20) NOT NULL DEFAULT 'monthly',
        "periodStart" TIMESTAMPTZ NOT NULL,
        "periodEnd" TIMESTAMPTZ NOT NULL,
        amount INTEGER NOT NULL,
        currency VARCHAR(10) NOT NULL DEFAULT 'GHS',
        status VARCHAR(32) NOT NULL DEFAULT 'success',
        provider VARCHAR(32) NOT NULL DEFAULT 'manual',
        "providerReference" VARCHAR(255),
        "recordedBy" UUID REFERENCES users(id) ON DELETE SET NULL,
        notes TEXT,
        metadata JSONB NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS subscription_payments_tenant_idx
      ON ${quoteIdent('subscription_payments')} ("tenantId");
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS subscription_payments_period_idx
      ON ${quoteIdent('subscription_payments')} ("tenantId", "periodStart", "periodEnd");
    `);
    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS subscription_payments_provider_ref_unique
      ON ${quoteIdent('subscription_payments')} (provider, "providerReference")
      WHERE "providerReference" IS NOT NULL;
    `);

    console.log('create-subscription-payments-table completed.');
    if (isDirect && closeConnection) process.exit(0);
  } catch (error) {
    console.error('create-subscription-payments-table failed:', error);
    if (isDirect) process.exit(1);
    throw error;
  } finally {
    if (isDirect && closeConnection) {
      await sequelize.close().catch(() => {});
    }
  }
};

if (require.main === module) {
  createSubscriptionPaymentsTable();
}

module.exports = createSubscriptionPaymentsTable;
