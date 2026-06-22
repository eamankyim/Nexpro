const { sequelize } = require('../config/database');

async function up(options = {}) {
  const { closeConnection = true } = options;
  try {
    console.log('🔄 Creating dealers account tables...');
    await sequelize.query('SET statement_timeout TO 15000;');

    await sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_dealer_ledger_entry_type') THEN
          CREATE TYPE enum_dealer_ledger_entry_type AS ENUM (
            'opening_balance', 'sale_charge', 'payment', 'adjustment', 'reversal'
          );
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_dealer_ledger_direction') THEN
          CREATE TYPE enum_dealer_ledger_direction AS ENUM ('debit', 'credit');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_sale_channel') THEN
          CREATE TYPE enum_sale_channel AS ENUM ('retail', 'dealer');
        END IF;
      END $$;
    `);

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS dealer_price_tiers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name VARCHAR(120) NOT NULL,
        description TEXT NULL,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS dealers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        "shopId" UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        "businessName" VARCHAR(255) NOT NULL,
        "contactName" VARCHAR(255) NULL,
        phone VARCHAR(40) NULL,
        email VARCHAR(255) NULL,
        "creditTerms" VARCHAR(120) NULL,
        "creditLimit" NUMERIC(12, 2) NOT NULL DEFAULT 0,
        balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
        "priceTierId" UUID NULL REFERENCES dealer_price_tiers(id) ON DELETE SET NULL,
        notes TEXT NULL,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // dealers may predate shopId; CREATE TABLE IF NOT EXISTS does not add new columns
    console.log('  ➡️  Ensuring dealers.shopId column exists...');
    await sequelize.query(`
      ALTER TABLE dealers
      ADD COLUMN IF NOT EXISTS "shopId" UUID REFERENCES shops(id) ON DELETE CASCADE;
    `);

    console.log('  ➡️  Backfilling dealers.shopId from default shop per tenant...');
    await sequelize.query(`
      UPDATE dealers d
      SET "shopId" = s.id
      FROM shops s
      WHERE d."tenantId" = s."tenantId"
        AND s."isDefault" = true
        AND d."shopId" IS NULL;
    `);
    await sequelize.query(`
      UPDATE dealers d
      SET "shopId" = s.id
      FROM (
        SELECT DISTINCT ON ("tenantId") id, "tenantId"
        FROM shops
        WHERE "isActive" = true
        ORDER BY "tenantId", "isDefault" DESC, "createdAt" ASC
      ) s
      WHERE d."tenantId" = s."tenantId" AND d."shopId" IS NULL;
    `);

    await sequelize.query(`
      ALTER TABLE dealers
      ALTER COLUMN "shopId" SET NOT NULL;
    `).catch((err) => {
      if (err.message?.includes('contains null values')) {
        console.log('  ⚠️  dealers.shopId still has NULL rows; NOT NULL skipped until backfill completes.');
      } else {
        throw err;
      }
    });

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS dealer_product_prices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        "shopId" UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        "dealerId" UUID NULL REFERENCES dealers(id) ON DELETE CASCADE,
        "priceTierId" UUID NULL REFERENCES dealer_price_tiers(id) ON DELETE CASCADE,
        "productId" UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        "productVariantId" UUID NULL REFERENCES product_variants(id) ON DELETE CASCADE,
        "unitPrice" NUMERIC(12, 2) NOT NULL,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT dealer_product_prices_scope_check CHECK (
          ("dealerId" IS NOT NULL AND "priceTierId" IS NULL)
          OR ("dealerId" IS NULL AND "priceTierId" IS NOT NULL)
        )
      );
    `);

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS dealer_ledger_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        "dealerId" UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
        "shopId" UUID NULL REFERENCES shops(id) ON DELETE SET NULL,
        "entryType" enum_dealer_ledger_entry_type NOT NULL,
        direction enum_dealer_ledger_direction NOT NULL,
        amount NUMERIC(12, 2) NOT NULL,
        "balanceAfter" NUMERIC(12, 2) NOT NULL,
        "saleId" UUID NULL REFERENCES sales(id) ON DELETE SET NULL,
        "paymentId" UUID NULL REFERENCES payments(id) ON DELETE SET NULL,
        description VARCHAR(255) NULL,
        "entryDate" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "createdBy" UUID NULL REFERENCES users(id) ON DELETE SET NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await sequelize.query(`
      ALTER TABLE sales
        ADD COLUMN IF NOT EXISTS "dealerId" UUID NULL REFERENCES dealers(id) ON DELETE SET NULL;
    `);
    await sequelize.query(`
      ALTER TABLE sales
        ADD COLUMN IF NOT EXISTS "saleChannel" enum_sale_channel NOT NULL DEFAULT 'retail';
    `);

    await sequelize.query(`
      ALTER TABLE payments
        ADD COLUMN IF NOT EXISTS "dealerId" UUID NULL REFERENCES dealers(id) ON DELETE SET NULL;
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_dealers_tenant ON dealers ("tenantId");
      CREATE INDEX IF NOT EXISTS idx_dealers_tenant_shop ON dealers ("tenantId", "shopId");
      CREATE INDEX IF NOT EXISTS idx_dealers_tenant_shop_active ON dealers ("tenantId", "shopId", "isActive");
      CREATE UNIQUE INDEX IF NOT EXISTS uq_dealers_tenant_shop_business_name
        ON dealers ("tenantId", "shopId", "businessName");
      CREATE INDEX IF NOT EXISTS idx_dealer_ledger_dealer_date ON dealer_ledger_entries ("dealerId", "entryDate");
      CREATE INDEX IF NOT EXISTS idx_dealer_ledger_tenant ON dealer_ledger_entries ("tenantId");
      CREATE INDEX IF NOT EXISTS idx_dealer_product_prices_lookup ON dealer_product_prices ("tenantId", "shopId", "productId", "productVariantId");
      CREATE INDEX IF NOT EXISTS idx_sales_dealer ON sales ("dealerId");
      CREATE INDEX IF NOT EXISTS idx_sales_sale_channel ON sales ("saleChannel");
    `);

    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_dealer_product_prices_dealer
        ON dealer_product_prices ("tenantId", "shopId", "dealerId", "productId", COALESCE("productVariantId", '00000000-0000-0000-0000-000000000000'::uuid))
        WHERE "dealerId" IS NOT NULL AND "isActive" = true;
    `);
    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_dealer_product_prices_tier
        ON dealer_product_prices ("tenantId", "shopId", "priceTierId", "productId", COALESCE("productVariantId", '00000000-0000-0000-0000-000000000000'::uuid))
        WHERE "priceTierId" IS NOT NULL AND "isActive" = true;
    `);

    console.log('✅ Dealers account tables created');
  } catch (error) {
    console.error('❌ Dealers account migration failed:', error);
    throw error;
  } finally {
    if (closeConnection) {
      await sequelize.close();
    }
  }
}

module.exports = { up };

if (require.main === module) {
  up().then(() => process.exit(0)).catch(() => process.exit(1));
}
