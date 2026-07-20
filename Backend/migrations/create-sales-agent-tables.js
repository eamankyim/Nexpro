const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize, testConnection } = require('../config/database');

const quoteIdent = (identifier) => {
  if (!/^[a-z][a-z0-9_]*$/i.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }
  return `"${identifier}"`;
};

/**
 * Sales Agent growth MVP schema:
 * - sales_agents + unique codes
 * - tenant attribution columns
 * - commission ledger (due/paid), capped at 3 paid events per tenant-agent pair
 */
const createSalesAgentTables = async ({ closeConnection = true } = {}) => {
  const isDirect = require.main === module;
  try {
    console.log('create-sales-agent-tables...');
    if (isDirect) await testConnection();

    await sequelize.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS ${quoteIdent('sales_agents')} (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(150) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(40),
        status VARCHAR(32) NOT NULL DEFAULT 'pending',
        "commissionAmount" INTEGER NOT NULL DEFAULT 5000,
        notes TEXT,
        "leadId" UUID REFERENCES leads(id) ON DELETE SET NULL,
        "approvedAt" TIMESTAMPTZ,
        "approvedBy" UUID REFERENCES users(id) ON DELETE SET NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS sales_agents_status_idx
      ON ${quoteIdent('sales_agents')} (status);
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS sales_agents_email_idx
      ON ${quoteIdent('sales_agents')} (email);
    `);

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS ${quoteIdent('sales_agent_codes')} (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "salesAgentId" UUID NOT NULL REFERENCES sales_agents(id) ON DELETE CASCADE,
        code VARCHAR(64) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'active',
        label VARCHAR(120),
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS sales_agent_codes_code_unique
      ON ${quoteIdent('sales_agent_codes')} (LOWER(code));
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS sales_agent_codes_agent_idx
      ON ${quoteIdent('sales_agent_codes')} ("salesAgentId");
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS sales_agent_codes_status_idx
      ON ${quoteIdent('sales_agent_codes')} (status);
    `);

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS ${quoteIdent('sales_agent_commissions')} (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "salesAgentId" UUID NOT NULL REFERENCES sales_agents(id) ON DELETE CASCADE,
        "tenantId" UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        "subscriptionPaymentId" UUID REFERENCES subscription_payments(id) ON DELETE SET NULL,
        "periodNumber" INTEGER NOT NULL,
        amount INTEGER NOT NULL,
        currency VARCHAR(10) NOT NULL DEFAULT 'GHS',
        status VARCHAR(32) NOT NULL DEFAULT 'due',
        "paidAt" TIMESTAMPTZ,
        "paidBy" UUID REFERENCES users(id) ON DELETE SET NULL,
        notes TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT sales_agent_commissions_period_check
          CHECK ("periodNumber" >= 1 AND "periodNumber" <= 3)
      );
    `);

    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS sales_agent_commissions_tenant_agent_period_unique
      ON ${quoteIdent('sales_agent_commissions')} ("salesAgentId", "tenantId", "periodNumber");
    `);
    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS sales_agent_commissions_payment_unique
      ON ${quoteIdent('sales_agent_commissions')} ("subscriptionPaymentId")
      WHERE "subscriptionPaymentId" IS NOT NULL;
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS sales_agent_commissions_agent_status_idx
      ON ${quoteIdent('sales_agent_commissions')} ("salesAgentId", status);
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS sales_agent_commissions_tenant_idx
      ON ${quoteIdent('sales_agent_commissions')} ("tenantId");
    `);

    // Tenant attribution columns (safe if already present)
    await sequelize.query(`
      ALTER TABLE ${quoteIdent('tenants')}
      ADD COLUMN IF NOT EXISTS "referredByAgentId" UUID REFERENCES sales_agents(id) ON DELETE SET NULL;
    `);
    await sequelize.query(`
      ALTER TABLE ${quoteIdent('tenants')}
      ADD COLUMN IF NOT EXISTS "referredByAgentCode" VARCHAR(64);
    `);
    await sequelize.query(`
      ALTER TABLE ${quoteIdent('tenants')}
      ADD COLUMN IF NOT EXISTS "agentAttributedAt" TIMESTAMPTZ;
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS tenants_referred_by_agent_idx
      ON ${quoteIdent('tenants')} ("referredByAgentId");
    `);

    console.log('create-sales-agent-tables completed.');
    if (isDirect && closeConnection) process.exit(0);
  } catch (error) {
    console.error('create-sales-agent-tables failed:', error);
    if (isDirect) process.exit(1);
    throw error;
  } finally {
    if (isDirect && closeConnection) {
      await sequelize.close().catch(() => {});
    }
  }
};

if (require.main === module) {
  createSalesAgentTables();
}

module.exports = createSalesAgentTables;
