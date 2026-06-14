const { sequelize } = require('../config/database');

async function up(options = {}) {
  const { closeConnection = true } = options;
  try {
    console.log('🔄 Extending storefront reviews for studio services...');

    await sequelize.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'enum_storefront_reviews_review_type'
        ) AND NOT EXISTS (
          SELECT 1
          FROM pg_enum
          WHERE enumtypid = 'enum_storefront_reviews_review_type'::regtype
            AND enumlabel = 'service'
        ) THEN
          ALTER TYPE enum_storefront_reviews_review_type ADD VALUE 'service';
        END IF;

        IF EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'enum_storefront_reviews_reviewType'
        ) AND NOT EXISTS (
          SELECT 1
          FROM pg_enum
          WHERE enumtypid = '"enum_storefront_reviews_reviewType"'::regtype
            AND enumlabel = 'service'
        ) THEN
          ALTER TYPE "enum_storefront_reviews_reviewType" ADD VALUE 'service';
        END IF;
      END $$;
    `);

    await sequelize.query(`
      ALTER TABLE storefront_reviews
      ADD COLUMN IF NOT EXISTS "serviceListingId" UUID NULL REFERENCES online_service_listings(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS "jobId" UUID NULL REFERENCES jobs(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS "studioLocationId" UUID NULL REFERENCES studio_locations(id) ON DELETE SET NULL;
    `);

    await sequelize.query(`
      ALTER TABLE storefront_reviews
      ALTER COLUMN "saleId" DROP NOT NULL;
    `);

    await sequelize.query(`
      ALTER TABLE storefront_reviews
      DROP CONSTRAINT IF EXISTS storefront_reviews_type_target_check;
    `);

    await sequelize.query(`
      ALTER TABLE storefront_reviews
      ADD CONSTRAINT storefront_reviews_type_target_check CHECK (
        ("reviewType" = 'product' AND "productId" IS NOT NULL)
        OR ("reviewType" = 'store' AND "productId" IS NULL AND "serviceListingId" IS NULL)
        OR ("reviewType" = 'service' AND "serviceListingId" IS NOT NULL)
      );
    `);

    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_storefront_reviews_service_unique
      ON storefront_reviews ("storefrontCustomerId", COALESCE("jobId", "saleId"), "serviceListingId")
      WHERE "reviewType" = 'service' AND status <> 'removed';
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_storefront_reviews_public_service
      ON storefront_reviews ("serviceListingId", status, "createdAt" DESC)
      WHERE "reviewType" = 'service';
    `);

    console.log('✅ Storefront reviews extended for services');
  } catch (error) {
    console.error('❌ extend-storefront-reviews-for-services failed:', error);
    throw error;
  } finally {
    if (closeConnection) {
      try { await sequelize.close(); } catch (_) { /* ignore */ }
    }
  }
}

async function down() {
  await sequelize.query('DROP INDEX IF EXISTS idx_storefront_reviews_public_service;');
  await sequelize.query('DROP INDEX IF EXISTS idx_storefront_reviews_service_unique;');
  await sequelize.query(`
    ALTER TABLE storefront_reviews
    DROP COLUMN IF EXISTS "serviceListingId",
    DROP COLUMN IF EXISTS "jobId",
    DROP COLUMN IF EXISTS "studioLocationId";
  `);
}

if (require.main === module) {
  up().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { up, down };
