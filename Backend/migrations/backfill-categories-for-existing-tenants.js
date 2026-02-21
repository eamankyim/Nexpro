/**
 * Migration: Backfill inventory and product categories for existing tenants
 *
 * Runs the category seeder for each active tenant so that:
 * - Material (inventory) categories match current shopTypes config (e.g. restaurant = ingredients).
 * - Product categories match productCategories config (e.g. restaurant = menu categories).
 * Safe to run multiple times: uses findOrCreate, so existing categories are kept and new ones added.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize } = require('../config/database');
const { QueryTypes } = require('sequelize');
const { seedDefaultCategories } = require('../utils/categorySeeder');

const backfillCategoriesForExistingTenants = async (options = {}) => {
  const { closeConnection = true } = options;
  console.log('🔄 Backfilling inventory & product categories for existing tenants...');

  try {
    const tenants = await sequelize.query(
      `SELECT id, "businessType",
              metadata->>'studioType' AS "studioType",
              metadata->>'shopType' AS "shopType"
       FROM tenants
       WHERE status = 'active'`,
      { type: QueryTypes.SELECT }
    );

    console.log(`Found ${tenants.length} active tenant(s).`);

    for (const tenant of tenants) {
      const businessType = tenant.businessType || 'shop';
      const shopType = tenant.shopType || null;
      const studioType = tenant.studioType || null;

      try {
        await seedDefaultCategories(tenant.id, businessType, shopType, studioType);
      } catch (err) {
        console.error(`  ❌ Tenant ${tenant.id} (${businessType}${shopType ? `/${shopType}` : ''}): ${err.message}`);
      }
    }

    console.log('✅ Backfill completed.');

    if (closeConnection) {
      await sequelize.close();
    }
  } catch (error) {
    console.error('❌ Backfill failed:', error);
    throw error;
  }
};

if (require.main === module) {
  backfillCategoriesForExistingTenants()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = backfillCategoriesForExistingTenants;
