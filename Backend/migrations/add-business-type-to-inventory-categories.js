/**
 * Migration: Add businessType, studioType, shopType to inventory_categories
 *
 * Enables inventory categories to be scoped by business type and shop/studio type.
 * Null values mean "applies to all" for backward compatibility.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize } = require('../config/database');

const addBusinessTypeToInventoryCategories = async (options = {}) => {
  const { closeConnection = true } = options;
  console.log('Adding businessType, studioType, shopType to inventory_categories...');

  try {
    await sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_inventory_categories_businessType" AS ENUM ('shop', 'studio', 'pharmacy');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_inventory_categories_studioType" AS ENUM ('printing_press', 'mechanic', 'barber', 'salon');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await sequelize.query(`
      ALTER TABLE inventory_categories
      ADD COLUMN IF NOT EXISTS "businessType" "enum_inventory_categories_businessType";
    `);

    await sequelize.query(`
      ALTER TABLE inventory_categories
      ADD COLUMN IF NOT EXISTS "studioType" "enum_inventory_categories_studioType";
    `);

    await sequelize.query(`
      ALTER TABLE inventory_categories
      ADD COLUMN IF NOT EXISTS "shopType" VARCHAR(50);
    `);

    console.log('Added businessType, studioType, shopType to inventory_categories');

    if (closeConnection) {
      await sequelize.close();
    }
  } catch (error) {
    console.error('Error adding business type columns to inventory_categories:', error);
    throw error;
  }
};

if (require.main === module) {
  addBusinessTypeToInventoryCategories()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}

module.exports = addBusinessTypeToInventoryCategories;
