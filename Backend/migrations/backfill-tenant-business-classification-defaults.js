/**
 * Backfill tenant business classification defaults.
 *
 * Safe to run multiple times:
 * - Missing businessType is inferred from explicit subtype metadata where possible, else shop.
 * - Missing shopType is copied from explicit businessSubType where present, else "other".
 * - Missing studioType is only set for studio tenants when an explicit subtype already exists.
 * - onboarding metadata is never created or modified.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { QueryTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { DEFAULT_SHOP_TYPE } = require('../utils/tenantClassification');

const STUDIO_SUB_TYPES = [
  'printing_press',
  'software_it_services',
  'other_professional_services',
  'barber_shop',
  'hair_salon',
  'spa_nail_bar',
  'mechanic_workshop',
  'car_wash',
  'mechanic',
  'barber',
  'salon',
];

const PHARMACY_SUB_TYPES = ['community_pharmacy', 'clinic_pharmacy'];
const LEGACY_STUDIO_TYPES = ['printing_press', 'mechanic', 'barber', 'salon'];

const hasArg = (arg) => process.argv.includes(arg);

const quoteSqlList = (values) => values.map((value) => sequelize.escape(value)).join(', ');

const countRows = async () => {
  const [counts] = await sequelize.query(
    `
    SELECT
      COUNT(*) FILTER (WHERE "businessType" IS NULL) AS "missingBusinessType",
      COUNT(*) FILTER (
        WHERE "businessType"::text = 'shop'
          AND NULLIF(metadata->>'shopType', '') IS NULL
      ) AS "missingShopType",
      COUNT(*) FILTER (
        WHERE "businessType"::text = 'studio'
          AND NULLIF(metadata->>'studioType', '') IS NULL
          AND NULLIF(metadata->>'businessSubType', '') IS NOT NULL
      ) AS "missingStudioTypeFromSubtype",
      COUNT(*) FILTER (WHERE "businessType"::text IN (${quoteSqlList(LEGACY_STUDIO_TYPES)})) AS "legacyStudioBusinessType"
    FROM tenants;
    `,
    { type: QueryTypes.SELECT }
  );
  return counts;
};

const backfillTenantBusinessClassificationDefaults = async (options = {}) => {
  const { closeConnection = true, dryRun = false } = options;
  console.log(`🏷️  Backfilling tenant business classification defaults (${dryRun ? 'dry run' : 'apply'})...`);

  try {
    try {
      await sequelize.query(`
        ALTER TYPE "enum_tenants_businessType" ADD VALUE IF NOT EXISTS 'studio';
      `);
    } catch (error) {
      console.warn('[tenant-classification-backfill] Could not ensure studio enum value:', error?.message || error);
    }

    const before = await countRows();
    console.log('Before:', before);

    if (dryRun) {
      return before;
    }

    await sequelize.transaction(async (transaction) => {
      await sequelize.query(
        `
        UPDATE tenants
        SET metadata = '{}'::jsonb
        WHERE metadata IS NULL;
        `,
        { transaction }
      );

      await sequelize.query(
        `
        UPDATE tenants
        SET metadata = CASE
              WHEN NULLIF(metadata->>'studioType', '') IS NULL
                THEN jsonb_set(COALESCE(metadata, '{}'::jsonb), '{studioType}', to_jsonb("businessType"::text), true)
              ELSE metadata
            END,
            "businessType" = 'studio'::"enum_tenants_businessType"
        WHERE "businessType"::text IN (${quoteSqlList(LEGACY_STUDIO_TYPES)});
        `,
        { transaction }
      );

      await sequelize.query(
        `
        UPDATE tenants
        SET "businessType" = CASE
          WHEN NULLIF(metadata->>'studioType', '') IS NOT NULL
            OR NULLIF(metadata->>'businessSubType', '') IN (${quoteSqlList(STUDIO_SUB_TYPES)})
            THEN 'studio'::"enum_tenants_businessType"
          WHEN NULLIF(metadata->>'businessSubType', '') IN (${quoteSqlList(PHARMACY_SUB_TYPES)})
            THEN 'pharmacy'::"enum_tenants_businessType"
          ELSE 'shop'::"enum_tenants_businessType"
        END
        WHERE "businessType" IS NULL;
        `,
        { transaction }
      );

      await sequelize.query(
        `
        UPDATE tenants
        SET metadata = jsonb_set(
          COALESCE(metadata, '{}'::jsonb),
          '{shopType}',
          to_jsonb(COALESCE(NULLIF(metadata->>'businessSubType', ''), :defaultShopType)),
          true
        )
        WHERE "businessType"::text = 'shop'
          AND NULLIF(metadata->>'shopType', '') IS NULL;
        `,
        {
          transaction,
          replacements: { defaultShopType: DEFAULT_SHOP_TYPE },
        }
      );

      await sequelize.query(
        `
        UPDATE tenants
        SET metadata = jsonb_set(
          COALESCE(metadata, '{}'::jsonb),
          '{studioType}',
          to_jsonb(NULLIF(metadata->>'businessSubType', '')),
          true
        )
        WHERE "businessType"::text = 'studio'
          AND NULLIF(metadata->>'studioType', '') IS NULL
          AND NULLIF(metadata->>'businessSubType', '') IS NOT NULL;
        `,
        { transaction }
      );
    });

    const after = await countRows();
    console.log('After:', after);
    console.log('✅ Tenant business classification defaults backfilled.');
    return after;
  } finally {
    if (closeConnection) {
      await sequelize.close();
    }
  }
};

if (require.main === module) {
  backfillTenantBusinessClassificationDefaults({
    closeConnection: true,
    dryRun: hasArg('--dry-run'),
  })
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Tenant business classification backfill failed:', error);
      process.exit(1);
    });
}

module.exports = backfillTenantBusinessClassificationDefaults;
