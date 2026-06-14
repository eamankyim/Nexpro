const { sequelize } = require('../config/database');

async function up(options = {}) {
  const { closeConnection = true } = options;
  try {
    console.log('🔄 Creating online service listings and studio store fields...');

    await sequelize.query(`
      ALTER TABLE online_store_settings
      ADD COLUMN IF NOT EXISTS "studioLocationId" UUID NULL REFERENCES studio_locations(id) ON DELETE SET NULL;
    `);

    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_online_store_settings_tenant_studio
      ON online_store_settings ("tenantId", COALESCE("studioLocationId", '00000000-0000-0000-0000-000000000000'::uuid));
    `);

    await sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_online_service_listings_status') THEN
          CREATE TYPE enum_online_service_listings_status AS ENUM ('draft', 'published', 'hidden');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_online_service_listings_cta_type') THEN
          CREATE TYPE enum_online_service_listings_cta_type AS ENUM ('request_quote', 'book_service', 'fixed_price');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_online_service_listings_price_type') THEN
          CREATE TYPE enum_online_service_listings_price_type AS ENUM ('starting_from', 'fixed', 'quote_only');
        END IF;
      END $$;
    `);

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS online_service_listings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        "studioLocationId" UUID NULL REFERENCES studio_locations(id) ON DELETE SET NULL,
        "pricingTemplateId" UUID NULL REFERENCES pricing_templates(id) ON DELETE SET NULL,
        status enum_online_service_listings_status NOT NULL DEFAULT 'draft',
        title VARCHAR(180) NOT NULL,
        slug VARCHAR(120) NOT NULL,
        "shortDescription" VARCHAR(280) NULL,
        description TEXT NULL,
        category VARCHAR(120) NULL,
        "ctaType" enum_online_service_listings_cta_type NOT NULL DEFAULT 'request_quote',
        "priceType" enum_online_service_listings_price_type NOT NULL DEFAULT 'starting_from',
        "startingPrice" NUMERIC(12, 2) NULL,
        "compareAtPrice" NUMERIC(12, 2) NULL,
        "durationMinutes" INTEGER NULL,
        "turnaroundLabel" VARCHAR(80) NULL,
        images JSONB NOT NULL DEFAULT '[]'::jsonb,
        "pickupEnabled" BOOLEAN NOT NULL DEFAULT true,
        "deliveryEnabled" BOOLEAN NOT NULL DEFAULT false,
        "sortOrder" INTEGER NOT NULL DEFAULT 0,
        "publishedAt" TIMESTAMPTZ NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_online_service_listings_tenant_slug
      ON online_service_listings ("tenantId", LOWER(slug));
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_online_service_listings_tenant_status
      ON online_service_listings ("tenantId", status);
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_online_service_listings_studio
      ON online_service_listings ("studioLocationId");
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_online_service_listings_category
      ON online_service_listings (category);
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_online_service_listings_sort
      ON online_service_listings ("tenantId", "sortOrder", "createdAt" DESC);
    `);

    console.log('✅ Online service listings ready');
  } catch (error) {
    console.error('❌ create-online-service-listings failed:', error);
    throw error;
  } finally {
    if (closeConnection) {
      try { await sequelize.close(); } catch (_) { /* ignore */ }
    }
  }
}

async function down() {
  await sequelize.query('DROP TABLE IF EXISTS online_service_listings CASCADE;');
  await sequelize.query('DROP TYPE IF EXISTS enum_online_service_listings_price_type;');
  await sequelize.query('DROP TYPE IF EXISTS enum_online_service_listings_cta_type;');
  await sequelize.query('DROP TYPE IF EXISTS enum_online_service_listings_status;');
  await sequelize.query('ALTER TABLE online_store_settings DROP COLUMN IF EXISTS "studioLocationId";');
}

if (require.main === module) {
  up().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { up, down };
