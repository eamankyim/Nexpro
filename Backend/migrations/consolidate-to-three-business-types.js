/**
 * Migration: Consolidate to 3 business types (shop, studio, pharmacy)
 *
 * - Add 'studio' to business_type_enum
 * - Migrate printing_press, mechanic, barber, salon -> businessType='studio' with metadata.studioType
 * - Old enum values remain in DB (PostgreSQL doesn't allow removal) but are unused for new signups
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');

const consolidateBusinessTypes = async (options = {}) => {
  const { closeConnection = true } = options;
  console.log('🏗️  Consolidating to 3 business types (shop, studio, pharmacy)...');

  try {
    // Add values to enum_tenants_businessType (used by tenants table)
    for (const val of ['studio', 'mechanic', 'barber', 'salon']) {
      await sequelize.query(`
        ALTER TYPE "enum_tenants_businessType" ADD VALUE IF NOT EXISTS '${val}';
      `);
    }

    // Migrate printing_press -> studio with studioType=printing_press
    const [r1] = await sequelize.query(`
      UPDATE tenants
      SET "businessType" = 'studio',
          metadata = jsonb_set(COALESCE(metadata, '{}'), '{studioType}', '"printing_press"')
      WHERE "businessType" = 'printing_press'
      RETURNING id;
    `);
    console.log(`  Migrated ${r1?.length || 0} printing_press tenants to studio`);

    // Migrate mechanic -> studio with studioType=mechanic
    const [r2] = await sequelize.query(`
      UPDATE tenants
      SET "businessType" = 'studio',
          metadata = jsonb_set(COALESCE(metadata, '{}'), '{studioType}', '"mechanic"')
      WHERE "businessType" = 'mechanic'
      RETURNING id;
    `);
    console.log(`  Migrated ${r2?.length || 0} mechanic tenants to studio`);

    // Migrate barber -> studio with studioType=barber
    const [r3] = await sequelize.query(`
      UPDATE tenants
      SET "businessType" = 'studio',
          metadata = jsonb_set(COALESCE(metadata, '{}'), '{studioType}', '"barber"')
      WHERE "businessType" = 'barber'
      RETURNING id;
    `);
    console.log(`  Migrated ${r3?.length || 0} barber tenants to studio`);

    // Migrate salon -> studio with studioType=salon
    const [r4] = await sequelize.query(`
      UPDATE tenants
      SET "businessType" = 'studio',
          metadata = jsonb_set(COALESCE(metadata, '{}'), '{studioType}', '"salon"')
      WHERE "businessType" = 'salon'
      RETURNING id;
    `);
    console.log(`  Migrated ${r4?.length || 0} salon tenants to studio`);

    console.log('✅ Business type consolidation completed!');
  } catch (error) {
    console.error('💥 Migration failed:', error);
    throw error;
  } finally {
    if (closeConnection) {
      await sequelize.close();
    }
  }
};

if (require.main === module) {
  consolidateBusinessTypes({ closeConnection: true })
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = consolidateBusinessTypes;
