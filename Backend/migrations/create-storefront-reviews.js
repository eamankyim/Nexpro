const { sequelize } = require('../config/database');

async function up(options = {}) {
  const { closeConnection = true } = options;
  try {
    console.log('🔄 Creating storefront reviews table...');

    await sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_storefront_reviews_review_type') THEN
          CREATE TYPE enum_storefront_reviews_review_type AS ENUM ('store', 'product');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_storefront_reviews_status') THEN
          CREATE TYPE enum_storefront_reviews_status AS ENUM ('published', 'hidden', 'removed');
        END IF;
      END $$;
    `);

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS storefront_reviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "reviewType" enum_storefront_reviews_review_type NOT NULL,
        "storefrontCustomerId" UUID NOT NULL REFERENCES storefront_customers(id) ON DELETE CASCADE,
        "tenantId" UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        "shopId" UUID NULL REFERENCES shops(id) ON DELETE SET NULL,
        "listingId" UUID NULL REFERENCES online_product_listings(id) ON DELETE SET NULL,
        "productId" UUID NULL REFERENCES products(id) ON DELETE SET NULL,
        "productVariantId" UUID NULL REFERENCES product_variants(id) ON DELETE SET NULL,
        "saleId" UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
        "saleItemId" UUID NULL REFERENCES sale_items(id) ON DELETE SET NULL,
        rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
        title VARCHAR(120) NULL,
        comment TEXT NULL,
        status enum_storefront_reviews_status NOT NULL DEFAULT 'published',
        "verifiedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT storefront_reviews_type_target_check CHECK (
          ("reviewType" = 'product' AND "productId" IS NOT NULL)
          OR ("reviewType" = 'store' AND "productId" IS NULL)
        )
      );
    `);

    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_storefront_reviews_product_unique
      ON storefront_reviews ("storefrontCustomerId", "saleId", "productId")
      WHERE "reviewType" = 'product' AND status <> 'removed';
    `);

    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_storefront_reviews_store_unique
      ON storefront_reviews (
        "storefrontCustomerId",
        "saleId",
        "tenantId",
        COALESCE("shopId", '00000000-0000-0000-0000-000000000000'::uuid)
      )
      WHERE "reviewType" = 'store' AND status <> 'removed';
    `);

    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_storefront_reviews_public_product ON storefront_reviews ("listingId", status, "createdAt" DESC) WHERE "reviewType" = 'product';`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_storefront_reviews_public_store ON storefront_reviews ("tenantId", "shopId", status, "createdAt" DESC) WHERE "reviewType" = 'store';`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_storefront_reviews_customer_created ON storefront_reviews ("storefrontCustomerId", "createdAt" DESC);`);

    console.log('✅ Storefront reviews table ready.');
  } catch (error) {
    console.error('❌ create-storefront-reviews failed:', error);
    throw error;
  } finally {
    if (closeConnection) {
      try { await sequelize.close(); } catch (_) { /* ignore */ }
    }
  }
}

async function down() {
  await sequelize.query('DROP TABLE IF EXISTS storefront_reviews CASCADE;');
  await sequelize.query('DROP TYPE IF EXISTS enum_storefront_reviews_status;');
  await sequelize.query('DROP TYPE IF EXISTS enum_storefront_reviews_review_type;');
}

if (require.main === module) {
  up().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { up, down };
