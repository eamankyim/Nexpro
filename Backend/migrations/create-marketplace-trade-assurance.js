const { sequelize } = require('../config/database');

async function up(options = {}) {
  const { closeConnection = true } = options;
  try {
    console.log('🔄 Creating marketplace trade assurance tables...');
    await sequelize.query('SET statement_timeout TO 15000;');

    await sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_marketplace_order_payment_status') THEN
          CREATE TYPE enum_marketplace_order_payment_status AS ENUM ('paid_held', 'released', 'refunded', 'disputed');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_marketplace_ledger_entry_type') THEN
          CREATE TYPE enum_marketplace_ledger_entry_type AS ENUM ('hold', 'release', 'payout', 'refund', 'fee', 'adjustment');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_marketplace_ledger_balance_type') THEN
          CREATE TYPE enum_marketplace_ledger_balance_type AS ENUM ('pending', 'available', 'paid_out', 'fee', 'refunded');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_marketplace_ledger_direction') THEN
          CREATE TYPE enum_marketplace_ledger_direction AS ENUM ('credit', 'debit');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_marketplace_payout_status') THEN
          CREATE TYPE enum_marketplace_payout_status AS ENUM ('available', 'processing', 'paid_out', 'cancelled');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_marketplace_dispute_status') THEN
          CREATE TYPE enum_marketplace_dispute_status AS ENUM ('open', 'under_review', 'resolved_release', 'resolved_refund', 'cancelled');
        END IF;
      END $$;
    `);

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS marketplace_order_payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        "shopId" UUID NULL REFERENCES shops(id) ON DELETE SET NULL,
        "saleId" UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
        "storefrontCustomerId" UUID NULL REFERENCES storefront_customers(id) ON DELETE SET NULL,
        currency VARCHAR(8) NOT NULL DEFAULT 'GHS',
        "grossAmount" NUMERIC(12, 2) NOT NULL DEFAULT 0,
        "feeAmount" NUMERIC(12, 2) NOT NULL DEFAULT 0,
        "netAmount" NUMERIC(12, 2) NOT NULL DEFAULT 0,
        "refundedAmount" NUMERIC(12, 2) NOT NULL DEFAULT 0,
        status enum_marketplace_order_payment_status NOT NULL DEFAULT 'paid_held',
        "paymentProvider" VARCHAR(40) NULL,
        "providerReference" VARCHAR(160) NULL,
        "heldAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "releaseEligibleAt" TIMESTAMPTZ NULL,
        "releasedAt" TIMESTAMPTZ NULL,
        "refundedAt" TIMESTAMPTZ NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS marketplace_payouts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        "shopId" UUID NULL REFERENCES shops(id) ON DELETE SET NULL,
        "saleId" UUID NULL REFERENCES sales(id) ON DELETE SET NULL,
        "marketplaceOrderPaymentId" UUID NULL REFERENCES marketplace_order_payments(id) ON DELETE SET NULL,
        "payoutNumber" VARCHAR(40) NOT NULL UNIQUE,
        amount NUMERIC(12, 2) NOT NULL,
        currency VARCHAR(8) NOT NULL DEFAULT 'GHS',
        status enum_marketplace_payout_status NOT NULL DEFAULT 'available',
        "releaseReason" VARCHAR(120) NULL,
        "releasedBy" UUID NULL REFERENCES users(id) ON DELETE SET NULL,
        "releasedAt" TIMESTAMPTZ NULL,
        "paidOutAt" TIMESTAMPTZ NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS marketplace_ledger_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        "shopId" UUID NULL REFERENCES shops(id) ON DELETE SET NULL,
        "saleId" UUID NULL REFERENCES sales(id) ON DELETE SET NULL,
        "marketplaceOrderPaymentId" UUID NULL REFERENCES marketplace_order_payments(id) ON DELETE SET NULL,
        "marketplacePayoutId" UUID NULL REFERENCES marketplace_payouts(id) ON DELETE SET NULL,
        "entryType" enum_marketplace_ledger_entry_type NOT NULL,
        "balanceType" enum_marketplace_ledger_balance_type NOT NULL,
        direction enum_marketplace_ledger_direction NOT NULL,
        amount NUMERIC(12, 2) NOT NULL,
        currency VARCHAR(8) NOT NULL DEFAULT 'GHS',
        description VARCHAR(255) NULL,
        "createdBy" UUID NULL REFERENCES users(id) ON DELETE SET NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS marketplace_disputes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        "shopId" UUID NULL REFERENCES shops(id) ON DELETE SET NULL,
        "saleId" UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
        "marketplaceOrderPaymentId" UUID NULL REFERENCES marketplace_order_payments(id) ON DELETE SET NULL,
        "storefrontCustomerId" UUID NULL REFERENCES storefront_customers(id) ON DELETE SET NULL,
        status enum_marketplace_dispute_status NOT NULL DEFAULT 'open',
        reason VARCHAR(120) NOT NULL DEFAULT 'issue',
        message TEXT NULL,
        "openedByEmail" VARCHAR(160) NULL,
        "openedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "resolvedAt" TIMESTAMPTZ NULL,
        "resolvedBy" UUID NULL REFERENCES users(id) ON DELETE SET NULL,
        "resolutionNotes" TEXT NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await sequelize.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_marketplace_order_payments_sale ON marketplace_order_payments ("saleId");`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_marketplace_order_payments_tenant_status ON marketplace_order_payments ("tenantId", status);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_marketplace_order_payments_release ON marketplace_order_payments ("releaseEligibleAt") WHERE status = 'paid_held';`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_marketplace_ledger_tenant_balance ON marketplace_ledger_entries ("tenantId", "balanceType", "createdAt" DESC);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_marketplace_ledger_payment ON marketplace_ledger_entries ("marketplaceOrderPaymentId");`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_marketplace_payouts_tenant_status ON marketplace_payouts ("tenantId", status, "createdAt" DESC);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_marketplace_disputes_tenant_status ON marketplace_disputes ("tenantId", status, "createdAt" DESC);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_marketplace_disputes_payment ON marketplace_disputes ("marketplaceOrderPaymentId");`);

    await sequelize.query('SET statement_timeout TO 0;');
    console.log('✅ marketplace trade assurance tables ready');
  } catch (error) {
    console.error('❌ create-marketplace-trade-assurance failed:', error);
    throw error;
  } finally {
    if (closeConnection) {
      try { await sequelize.close(); } catch (_) { /* ignore */ }
    }
  }
}

async function down() {
  await sequelize.query('DROP TABLE IF EXISTS marketplace_disputes CASCADE;');
  await sequelize.query('DROP TABLE IF EXISTS marketplace_ledger_entries CASCADE;');
  await sequelize.query('DROP TABLE IF EXISTS marketplace_payouts CASCADE;');
  await sequelize.query('DROP TABLE IF EXISTS marketplace_order_payments CASCADE;');
  await sequelize.query('DROP TYPE IF EXISTS enum_marketplace_dispute_status;');
  await sequelize.query('DROP TYPE IF EXISTS enum_marketplace_payout_status;');
  await sequelize.query('DROP TYPE IF EXISTS enum_marketplace_ledger_direction;');
  await sequelize.query('DROP TYPE IF EXISTS enum_marketplace_ledger_balance_type;');
  await sequelize.query('DROP TYPE IF EXISTS enum_marketplace_ledger_entry_type;');
  await sequelize.query('DROP TYPE IF EXISTS enum_marketplace_order_payment_status;');
}

if (require.main === module) {
  up().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { up, down };
