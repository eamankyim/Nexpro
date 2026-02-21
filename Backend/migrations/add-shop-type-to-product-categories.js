/**
 * Migration: Add shopType to product_categories
 *
 * shopType applies when businessType is 'shop' (e.g. supermarket, hardware, restaurant).
 * Enables shop-type-specific product categories.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize } = require('../config/database');

const addShopTypeToProductCategories = async (options = {}) => {
  const { closeConnection = true } = options;
  console.log('Adding shopType to product_categories...');

  try {
    await sequelize.query(`
      ALTER TABLE product_categories
      ADD COLUMN IF NOT EXISTS "shopType" VARCHAR(50);
    `);

    await sequelize.query(`
      COMMENT ON COLUMN product_categories."shopType" IS 'Shop type this category belongs to (only relevant when businessType is shop)';
    `);

    console.log('Added shopType column to product_categories');

    if (closeConnection) {
      await sequelize.close();
    }
  } catch (error) {
    console.error('Error adding shopType to product_categories:', error);
    throw error;
  }
};

if (require.main === module) {
  addShopTypeToProductCategories()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}

module.exports = addShopTypeToProductCategories;
