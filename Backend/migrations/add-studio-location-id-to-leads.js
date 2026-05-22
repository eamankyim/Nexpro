const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize, testConnection } = require('../config/database');
const { QueryTypes } = require('sequelize');

/**
 * Adds studioLocationId to leads and backfills from default studio location per tenant.
 */
const addStudioLocationIdToLeads = async () => {
  const isDirect = require.main === module;
  try {
    console.log('🔄 add-studio-location-id-to-leads...\n');
    if (isDirect) await testConnection();

    const rows = await sequelize.query(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'leads' LIMIT 1`,
      { type: QueryTypes.SELECT }
    );
    if (!rows.length) {
      console.log('  ⏭️  Skipping leads (table does not exist)');
      if (isDirect) process.exit(0);
      return;
    }

    console.log('  ➡️  Adding leads.studioLocationId...');
    await sequelize.query(`
      ALTER TABLE leads
      ADD COLUMN IF NOT EXISTS "studioLocationId" UUID
      REFERENCES studio_locations(id) ON UPDATE CASCADE ON DELETE SET NULL;
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS leads_studio_location_idx ON leads("studioLocationId");
    `);

    console.log('  ➡️  Backfilling leads.studioLocationId from default studio location...');
    await sequelize.query(`
      UPDATE leads l
      SET "studioLocationId" = sl.id
      FROM studio_locations sl
      WHERE l."tenantId" = sl."tenantId"
        AND sl."isDefault" = true
        AND l."studioLocationId" IS NULL;
    `);
    await sequelize.query(`
      UPDATE leads l
      SET "studioLocationId" = sl.id
      FROM (
        SELECT DISTINCT ON ("tenantId") id, "tenantId"
        FROM studio_locations
        WHERE "isActive" = true
        ORDER BY "tenantId", "isDefault" DESC, "createdAt" ASC
      ) sl
      WHERE l."tenantId" = sl."tenantId" AND l."studioLocationId" IS NULL;
    `);

    console.log('✅ add-studio-location-id-to-leads completed.\n');
    if (isDirect) process.exit(0);
  } catch (error) {
    console.error('❌ add-studio-location-id-to-leads failed:', error);
    if (isDirect) process.exit(1);
    throw error;
  }
};

if (require.main === module) {
  addStudioLocationIdToLeads();
}

module.exports = addStudioLocationIdToLeads;
