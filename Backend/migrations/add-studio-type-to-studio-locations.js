const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');

/**
 * Per-studio business flavor selected from the same onboarding sub-type catalog.
 */
const addStudioTypeToStudioLocations = async () => {
  console.log('🚀 Adding studioType to studio locations...');
  const transaction = await sequelize.transaction();

  try {
    await sequelize.query(
      `
      ALTER TABLE studio_locations
      ADD COLUMN IF NOT EXISTS "studioType" VARCHAR(100);
    `,
      { transaction }
    );

    await sequelize.query(
      `
      UPDATE studio_locations sl
      SET "studioType" = COALESCE(
        sl.metadata->>'studioType',
        (
          SELECT COALESCE(
            t.metadata->>'studioType',
            t.metadata->>'businessSubType'
          )
          FROM tenants t
          WHERE t.id = sl."tenantId"
        )
      )
      WHERE sl."studioType" IS NULL
        AND (
          sl.metadata->>'studioType' IS NOT NULL
          OR EXISTS (
            SELECT 1 FROM tenants t
            WHERE t.id = sl."tenantId"
              AND (
                t.metadata->>'studioType' IS NOT NULL
                OR t.metadata->>'businessSubType' IS NOT NULL
              )
          )
        );
    `,
      { transaction }
    );

    await transaction.commit();
    console.log('✅ Studio location studioType migration completed.');
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Studio location studioType migration failed:', error);
    throw error;
  }
};

if (require.main === module) {
  addStudioTypeToStudioLocations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = addStudioTypeToStudioLocations;
