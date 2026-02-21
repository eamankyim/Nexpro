/**
 * Migration: Seed default equipment categories for all existing tenants
 *
 * Creates default equipment categories (Furniture, IT & Electronics, Vehicles, etc.)
 * for each tenant so the Equipment page has useful categories without re-onboarding.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize } = require('../config/database');
const { QueryTypes } = require('sequelize');
const { seedDefaultEquipmentCategories } = require('../utils/categorySeeder');

const seedDefaultEquipmentCategoriesForAllTenants = async (options = {}) => {
  const { closeConnection = true } = options;
  console.log('Seeding default equipment categories for all tenants...');

  try {
    const tenants = await sequelize.query(
      'SELECT id FROM tenants WHERE status = \'active\'',
      { type: QueryTypes.SELECT }
    );
    console.log(`Found ${tenants.length} active tenants`);

    let totalCreated = 0;
    for (const tenant of tenants) {
      const created = await seedDefaultEquipmentCategories(tenant.id);
      totalCreated += created;
    }

    console.log(`Done. Created ${totalCreated} equipment categories across all tenants.`);

    if (closeConnection) {
      await sequelize.close();
    }
  } catch (error) {
    console.error('Error seeding default equipment categories:', error);
    throw error;
  }
};

if (require.main === module) {
  seedDefaultEquipmentCategoriesForAllTenants()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = seedDefaultEquipmentCategoriesForAllTenants;
