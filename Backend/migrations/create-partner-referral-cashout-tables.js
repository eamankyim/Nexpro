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
 * Partner referrals + cashout ledger extensions for Sabito marketer product.
 */
const createPartnerReferralCashoutTables = async ({ closeConnection = true } = {}) => {
  const isDirect = require.main === module;
  try {
    console.log('[createPartnerReferralCashoutTables] Starting...');
    if (isDirect) await testConnection();

    await sequelize.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS ${quoteIdent('partner_referrals')} (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        "marketerId" UUID NOT NULL REFERENCES marketers(id) ON DELETE CASCADE,
        "partnershipId" UUID NOT NULL REFERENCES partnerships(id) ON DELETE CASCADE,
        "clientName" VARCHAR(160) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(40),
        "emailNormalized" VARCHAR(255),
        "phoneNormalized" VARCHAR(40),
        location VARCHAR(160),
        note TEXT,
        status VARCHAR(32) NOT NULL DEFAULT 'pending',
        "customerId" UUID REFERENCES customers(id) ON DELETE SET NULL,
        "matchedAt" TIMESTAMPTZ,
        "matchedBy" VARCHAR(40),
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS partner_referrals_tenant_status_idx
      ON ${quoteIdent('partner_referrals')} ("tenantId", status);
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS partner_referrals_marketer_status_idx
      ON ${quoteIdent('partner_referrals')} ("marketerId", status);
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS partner_referrals_email_norm_idx
      ON ${quoteIdent('partner_referrals')} ("tenantId", "emailNormalized");
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS partner_referrals_phone_norm_idx
      ON ${quoteIdent('partner_referrals')} ("tenantId", "phoneNormalized");
    `);
    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS partner_referrals_marketer_tenant_email_uq
      ON ${quoteIdent('partner_referrals')} ("marketerId", "tenantId", "emailNormalized")
      WHERE "emailNormalized" IS NOT NULL;
    `);
    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS partner_referrals_marketer_tenant_phone_uq
      ON ${quoteIdent('partner_referrals')} ("marketerId", "tenantId", "phoneNormalized")
      WHERE "phoneNormalized" IS NOT NULL;
    `);

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS ${quoteIdent('partner_cashout_requests')} (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        "marketerId" UUID NOT NULL REFERENCES marketers(id) ON DELETE CASCADE,
        amount DECIMAL(12, 2) NOT NULL,
        currency VARCHAR(10) NOT NULL DEFAULT 'GHS',
        status VARCHAR(32) NOT NULL DEFAULT 'pending',
        notes TEXT,
        "payoutReference" VARCHAR(160),
        "processedAt" TIMESTAMPTZ,
        "processedByUserId" UUID REFERENCES users(id) ON DELETE SET NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS partner_cashouts_tenant_status_idx
      ON ${quoteIdent('partner_cashout_requests')} ("tenantId", status);
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS partner_cashouts_marketer_status_idx
      ON ${quoteIdent('partner_cashout_requests')} ("marketerId", status);
    `);

    await sequelize.query(`
      ALTER TABLE ${quoteIdent('partner_commissions')}
      ADD COLUMN IF NOT EXISTS "cashoutRequestId" UUID
      REFERENCES partner_cashout_requests(id) ON DELETE SET NULL;
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS partner_commissions_cashout_idx
      ON ${quoteIdent('partner_commissions')} ("cashoutRequestId");
    `);

    console.log('[createPartnerReferralCashoutTables] Done.');
  } catch (error) {
    console.error('[createPartnerReferralCashoutTables] Failed:', error.message);
    throw error;
  } finally {
    if (closeConnection && isDirect) {
      await sequelize.close();
    }
  }
};

module.exports = createPartnerReferralCashoutTables;

if (require.main === module) {
  createPartnerReferralCashoutTables()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
