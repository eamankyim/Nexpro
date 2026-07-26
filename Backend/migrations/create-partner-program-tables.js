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
 * Sabito Partner Program schema:
 * settings, featured services, marketers, applications, partnerships, commissions,
 * plus attribution columns on customers / sales / jobs.
 */
const createPartnerProgramTables = async ({ closeConnection = true } = {}) => {
  const isDirect = require.main === module;
  try {
    console.log('[createPartnerProgramTables] Starting...');
    if (isDirect) await testConnection();

    await sequelize.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS ${quoteIdent('partner_program_settings')} (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
        enabled BOOLEAN NOT NULL DEFAULT false,
        listed BOOLEAN NOT NULL DEFAULT false,
        slug VARCHAR(80) NOT NULL,
        "displayName" VARCHAR(160) NOT NULL,
        pitch TEXT,
        "logoUrl" TEXT,
        category VARCHAR(80),
        location VARCHAR(160),
        "firstClientRatePercent" DECIMAL(6, 2) NOT NULL DEFAULT 10,
        "returningClientRatePercent" DECIMAL(6, 2) NOT NULL DEFAULT 5,
        "attributionMonths" INTEGER NOT NULL DEFAULT 12,
        "maxMarketers" INTEGER NOT NULL DEFAULT 10,
        "payoutNotes" TEXT,
        "setupCompletedAt" TIMESTAMPTZ,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS partner_program_settings_slug_unique
      ON ${quoteIdent('partner_program_settings')} (LOWER(slug));
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS partner_program_settings_listed_idx
      ON ${quoteIdent('partner_program_settings')} (enabled, listed);
    `);

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS ${quoteIdent('partner_program_services')} (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        "partnerProgramSettingsId" UUID NOT NULL REFERENCES partner_program_settings(id) ON DELETE CASCADE,
        "productId" UUID REFERENCES products(id) ON DELETE SET NULL,
        "pricingTemplateId" UUID REFERENCES pricing_templates(id) ON DELETE SET NULL,
        "onlineServiceListingId" UUID REFERENCES online_service_listings(id) ON DELETE SET NULL,
        label VARCHAR(160) NOT NULL,
        "firstClientRatePercent" DECIMAL(6, 2),
        "returningClientRatePercent" DECIMAL(6, 2),
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS partner_program_services_tenant_idx
      ON ${quoteIdent('partner_program_services')} ("tenantId");
    `);

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS ${quoteIdent('marketers')} (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(160) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(40),
        password VARCHAR(255) NOT NULL,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "momoNumber" VARCHAR(40),
        "bankDetails" TEXT,
        "lastLoginAt" TIMESTAMPTZ,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS marketers_email_unique
      ON ${quoteIdent('marketers')} (LOWER(email));
    `);

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS ${quoteIdent('partnership_applications')} (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        "marketerId" UUID NOT NULL REFERENCES marketers(id) ON DELETE CASCADE,
        status VARCHAR(32) NOT NULL DEFAULT 'pending',
        pitch TEXT,
        "decisionNote" TEXT,
        "reviewedAt" TIMESTAMPTZ,
        "reviewedBy" UUID REFERENCES users(id) ON DELETE SET NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE ("tenantId", "marketerId")
      );
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS partnership_applications_tenant_status_idx
      ON ${quoteIdent('partnership_applications')} ("tenantId", status);
    `);

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS ${quoteIdent('partnerships')} (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        "marketerId" UUID NOT NULL REFERENCES marketers(id) ON DELETE CASCADE,
        "applicationId" UUID REFERENCES partnership_applications(id) ON DELETE SET NULL,
        "referralCode" VARCHAR(64) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'active',
        "firstClientRatePercent" DECIMAL(6, 2) NOT NULL,
        "returningClientRatePercent" DECIMAL(6, 2) NOT NULL,
        "attributionMonths" INTEGER NOT NULL DEFAULT 12,
        "activatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "revokedAt" TIMESTAMPTZ,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE ("tenantId", "marketerId"),
        UNIQUE ("referralCode")
      );
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS partnerships_tenant_status_idx
      ON ${quoteIdent('partnerships')} ("tenantId", status);
    `);

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS ${quoteIdent('partner_commissions')} (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        "partnershipId" UUID NOT NULL REFERENCES partnerships(id) ON DELETE CASCADE,
        "marketerId" UUID NOT NULL REFERENCES marketers(id) ON DELETE CASCADE,
        "customerId" UUID REFERENCES customers(id) ON DELETE SET NULL,
        "saleId" UUID REFERENCES sales(id) ON DELETE SET NULL,
        "invoiceId" UUID REFERENCES invoices(id) ON DELETE SET NULL,
        "paymentId" UUID REFERENCES payments(id) ON DELETE SET NULL,
        "rateType" VARCHAR(32) NOT NULL,
        "ratePercent" DECIMAL(6, 2) NOT NULL,
        "paymentAmount" DECIMAL(12, 2) NOT NULL,
        amount DECIMAL(12, 2) NOT NULL,
        currency VARCHAR(10) NOT NULL DEFAULT 'GHS',
        status VARCHAR(32) NOT NULL DEFAULT 'due',
        "paidAt" TIMESTAMPTZ,
        "paidBy" UUID REFERENCES users(id) ON DELETE SET NULL,
        "paidNote" TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS partner_commissions_payment_unique
      ON ${quoteIdent('partner_commissions')} ("paymentId")
      WHERE "paymentId" IS NOT NULL;
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS partner_commissions_tenant_status_idx
      ON ${quoteIdent('partner_commissions')} ("tenantId", status);
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS partner_commissions_marketer_status_idx
      ON ${quoteIdent('partner_commissions')} ("marketerId", status);
    `);

    // Attribution columns on customers
    await sequelize.query(`
      ALTER TABLE ${quoteIdent('customers')}
        ADD COLUMN IF NOT EXISTS "partnerMarketerId" UUID REFERENCES marketers(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "partnershipId" UUID REFERENCES partnerships(id) ON DELETE SET NULL;
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS customers_partnership_idx
      ON ${quoteIdent('customers')} ("partnershipId")
      WHERE "partnershipId" IS NOT NULL;
    `);

    // Attribution on sales
    await sequelize.query(`
      ALTER TABLE ${quoteIdent('sales')}
        ADD COLUMN IF NOT EXISTS "partnerMarketerId" UUID REFERENCES marketers(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "partnershipId" UUID REFERENCES partnerships(id) ON DELETE SET NULL;
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS sales_partnership_idx
      ON ${quoteIdent('sales')} ("partnershipId")
      WHERE "partnershipId" IS NOT NULL;
    `);

    // Attribution on jobs
    await sequelize.query(`
      ALTER TABLE ${quoteIdent('jobs')}
        ADD COLUMN IF NOT EXISTS "partnerMarketerId" UUID REFERENCES marketers(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "partnershipId" UUID REFERENCES partnerships(id) ON DELETE SET NULL;
    `);

    console.log('[createPartnerProgramTables] Done');
  } finally {
    if (closeConnection && isDirect) {
      await sequelize.close();
    }
  }
};

module.exports = createPartnerProgramTables;

if (require.main === module) {
  createPartnerProgramTables({ closeConnection: true })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
