const { sequelize } = require('../config/database');

const SERVICE_REVIEW_TYPE = 'service';
const KNOWN_REVIEW_TYPE_ENUMS = ['enum_storefront_reviews_review_type'];

/**
 * Resolves Postgres enum type names used by storefront_reviews."reviewType".
 * @param {import('sequelize').Sequelize} db
 * @param {string[]} [fallbackTypeNames]
 * @returns {Promise<string[]>}
 */
const discoverReviewTypeEnumTypes = async (db, fallbackTypeNames = KNOWN_REVIEW_TYPE_ENUMS) => {
  const [rows] = await db.query(`
    SELECT DISTINCT udt_name AS typname
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'storefront_reviews'
      AND column_name = 'reviewType'
      AND udt_name IS NOT NULL;
  `);

  const discovered = (rows || []).map((row) => row.typname).filter(Boolean);
  return [...new Set([...fallbackTypeNames, ...discovered])];
};

/**
 * Adds 'service' to a Postgres enum when the type exists and the value is missing.
 * Uses pg_type.oid (not ::regtype) so missing enum types are skipped safely.
 * @param {import('sequelize').Sequelize} db
 * @param {string} typeName
 * @returns {Promise<'added' | 'exists' | 'missing'>}
 */
const ensureEnumHasServiceValue = async (db, typeName) => {
  const [[typeRow]] = await db.query(
    `SELECT oid FROM pg_type WHERE typname = :typeName LIMIT 1`,
    { replacements: { typeName } }
  );
  if (!typeRow?.oid) {
    console.log(`   ⏭️  ${typeName}: type not found`);
    return 'missing';
  }

  const [[hasService]] = await db.query(
    `SELECT 1 AS ok FROM pg_enum WHERE enumtypid = :oid AND enumlabel = :value LIMIT 1`,
    { replacements: { oid: typeRow.oid, value: SERVICE_REVIEW_TYPE } }
  );
  if (hasService?.ok) {
    console.log(`   ✓ ${typeName}: service already present`);
    return 'exists';
  }

  await db.query(`ALTER TYPE "${typeName}" ADD VALUE '${SERVICE_REVIEW_TYPE}'`);
  console.log(`   ➕ ${typeName}: added service`);
  return 'added';
};

async function up(options = {}) {
  const { closeConnection = true } = options;
  try {
    console.log('🔄 Extending storefront reviews for studio services...');

    const reviewTypeEnums = await discoverReviewTypeEnumTypes(sequelize);
    console.log(`   reviewType enum types: ${reviewTypeEnums.length ? reviewTypeEnums.join(', ') : '(none)'}`);

    for (const typeName of reviewTypeEnums) {
      await ensureEnumHasServiceValue(sequelize, typeName);
    }

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

module.exports = {
  up,
  down,
  discoverReviewTypeEnumTypes,
  ensureEnumHasServiceValue,
  KNOWN_REVIEW_TYPE_ENUMS,
  SERVICE_REVIEW_TYPE,
};
