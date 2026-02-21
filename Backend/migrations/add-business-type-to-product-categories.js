/**
 * Migration: Add businessType and studioType to product_categories
 * 
 * Adds businessType and studioType columns to product_categories table
 * to allow categories to be specific to business types and studio types.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize } = require('../config/database');

const addBusinessTypeToProductCategories = async (options = {}) => {
  const { closeConnection = true } = options;
  console.log('📦 Adding businessType and studioType to product_categories...');

  try {
    // Create enum types if they don't exist
    await sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_product_categories_businessType" AS ENUM ('shop', 'studio', 'pharmacy');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_product_categories_studioType" AS ENUM ('printing_press', 'mechanic', 'barber', 'salon');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Add businessType column
    await sequelize.query(`
      ALTER TABLE product_categories
      ADD COLUMN IF NOT EXISTS "businessType" "enum_product_categories_businessType";
    `);

    // Add studioType column
    await sequelize.query(`
      ALTER TABLE product_categories
      ADD COLUMN IF NOT EXISTS "studioType" "enum_product_categories_studioType";
    `);

    // Add comment to businessType
    await sequelize.query(`
      COMMENT ON COLUMN product_categories."businessType" IS 'Business type this category belongs to (null = applies to all)';
    `);

    // Add comment to studioType
    await sequelize.query(`
      COMMENT ON COLUMN product_categories."studioType" IS 'Studio type this category belongs to (only relevant if businessType is studio)';
    `);

    console.log('✅ Added businessType and studioType columns to product_categories');

    if (closeConnection) {
      await sequelize.close();
    }
  } catch (error) {
    console.error('❌ Error adding businessType to product_categories:', error);
    throw error;
  }
};

if (require.main === module) {
  addBusinessTypeToProductCategories()
    .then(() => {
      console.log('✅ Migration completed successfully');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    });
}

module.exports = addBusinessTypeToProductCategories;
