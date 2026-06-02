const { sequelize } = require('../config/database');

async function up(options = {}) {
  const { closeConnection = true } = options;
  try {
    console.log('🔄 Creating online store tables...');
    await sequelize.query('SET statement_timeout TO 15000;');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS online_store_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        "shopId" UUID NULL REFERENCES shops(id) ON DELETE SET NULL,
        enabled BOOLEAN NOT NULL DEFAULT false,
        slug VARCHAR(80) NOT NULL,
        "displayName" VARCHAR(160) NOT NULL,
        description TEXT NULL,
        "logoUrl" TEXT NULL,
        "bannerImageUrl" TEXT NULL,
        "primaryColor" VARCHAR(24) NOT NULL DEFAULT '#166534',
        "contactPhone" VARCHAR(40) NULL,
        "whatsappNumber" VARCHAR(40) NULL,
        "contactEmail" VARCHAR(160) NULL,
        "pickupEnabled" BOOLEAN NOT NULL DEFAULT true,
        "deliveryEnabled" BOOLEAN NOT NULL DEFAULT false,
        "deliveryFee" NUMERIC(12, 2) NOT NULL DEFAULT 0,
        currency VARCHAR(8) NOT NULL DEFAULT 'GHS',
        "setupCompletedAt" TIMESTAMPTZ NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_online_product_listings_status') THEN
          CREATE TYPE enum_online_product_listings_status AS ENUM ('draft', 'published', 'hidden');
        END IF;
      END $$;
    `);
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS online_product_listings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        "shopId" UUID NULL REFERENCES shops(id) ON DELETE SET NULL,
        "productId" UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        "productVariantId" UUID NULL REFERENCES product_variants(id) ON DELETE CASCADE,
        status enum_online_product_listings_status NOT NULL DEFAULT 'draft',
        title VARCHAR(180) NOT NULL,
        slug VARCHAR(120) NOT NULL,
        "shortDescription" VARCHAR(280) NULL,
        description TEXT NULL,
        "salesCopy" TEXT NULL,
        "publicPrice" NUMERIC(12, 2) NOT NULL,
        "compareAtPrice" NUMERIC(12, 2) NULL,
        images JSONB NOT NULL DEFAULT '[]'::jsonb,
        "inventoryPolicy" VARCHAR(40) NOT NULL DEFAULT 'track',
        "sortOrder" INTEGER NOT NULL DEFAULT 0,
        "publishedAt" TIMESTAMPTZ NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await sequelize.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_online_store_settings_slug ON online_store_settings (LOWER(slug));`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_online_store_settings_tenant ON online_store_settings ("tenantId");`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_online_store_settings_shop ON online_store_settings ("shopId");`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_online_store_settings_enabled ON online_store_settings (enabled);`);
    await sequelize.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_online_store_settings_tenant_shop ON online_store_settings ("tenantId", COALESCE("shopId", '00000000-0000-0000-0000-000000000000'::uuid));`);
    await sequelize.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_online_product_listings_tenant_slug ON online_product_listings ("tenantId", LOWER(slug));`);
    await sequelize.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_online_product_listings_product_variant ON online_product_listings ("tenantId", "productId", COALESCE("productVariantId", '00000000-0000-0000-0000-000000000000'::uuid));`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_online_product_listings_tenant_status ON online_product_listings ("tenantId", status);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_online_product_listings_shop ON online_product_listings ("shopId");`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_online_product_listings_sort ON online_product_listings ("tenantId", "sortOrder", "createdAt" DESC);`);
    await sequelize.query('SET statement_timeout TO 0;');
    console.log('✅ online store tables ready');
  } catch (error) {
    console.error('❌ create-online-store-tables failed:', error);
    throw error;
  } finally {
    if (closeConnection) {
      try { await sequelize.close(); } catch (_) { /* ignore */ }
    }
  }
}

async function down() {
  await sequelize.query('DROP TABLE IF EXISTS online_product_listings CASCADE;');
  await sequelize.query('DROP TABLE IF EXISTS online_store_settings CASCADE;');
  await sequelize.query('DROP TYPE IF EXISTS enum_online_product_listings_status;');
}

if (require.main === module) {
  up().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { up, down };
