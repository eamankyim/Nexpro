const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize, testConnection } = require('../config/database');

/**
 * Reactivate legacy Phase 1 shoppers that were created inactive until email verification.
 * Admin-disabled accounts (verified or explicitly marked in metadata) are left inactive.
 */
const backfillStorefrontCustomersActiveUnverified = async (options = {}) => {
  const { closeConnection = false } = options;
  const isDirect = require.main === module;
  try {
    console.log('🔄 Backfilling legacy inactive unverified storefront shoppers...');
    if (isDirect) await testConnection();

    await sequelize.query(`ALTER TABLE storefront_customers ALTER COLUMN "isActive" SET DEFAULT true;`);

    const [, meta] = await sequelize.query(`
      UPDATE storefront_customers
      SET
        "isActive" = true,
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
          'reactivatedFromLegacyPendingAt',
          to_jsonb(NOW()::text)
        ),
        "updatedAt" = NOW()
      WHERE "isActive" = false
        AND "emailVerifiedAt" IS NULL
        AND COALESCE(metadata->>'disabledByAdmin', 'false') <> 'true'
        AND COALESCE(metadata->>'accountStatus', '') NOT IN ('disabled', 'suspended', 'deactivated')
        AND COALESCE(metadata->>'deactivatedBy', '') NOT IN ('admin', 'platform')
        AND COALESCE(metadata->'deactivation'->>'by', '') NOT IN ('admin', 'platform');
    `);

    const updatedCount = Number(meta?.rowCount || 0);
    console.log(`✅ Reactivated ${updatedCount} legacy inactive unverified storefront shopper(s).`);
  } catch (error) {
    console.error('❌ backfill-storefront-customers-active-unverified failed:', error);
    throw error;
  } finally {
    if (isDirect || closeConnection) {
      try { await sequelize.close(); } catch (_) { /* ignore */ }
    }
  }
};

if (require.main === module) {
  backfillStorefrontCustomersActiveUnverified({ closeConnection: true })
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = backfillStorefrontCustomersActiveUnverified;
