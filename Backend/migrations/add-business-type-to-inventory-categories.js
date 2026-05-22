/**
 * Migration: Add businessType, studioType, shopType to category tables used for materials.
 *
 * Historically this targeted inventory_categories; after rename-inventory-tables-to-materials
 * the table is materials_categories. Null values mean "applies to all" for backward compatibility.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize } = require('../config/database');
const { QueryTypes } = require('sequelize');

const addBusinessTypeToInventoryCategories = async (options = {}) => {
  const { closeConnection = true } = options;

  const [catTableRows] = await sequelize.query(
    `SELECT tablename AS table_name FROM pg_tables
     WHERE schemaname = 'public'
       AND tablename IN ('materials_categories', 'inventory_categories')`
  );
  const present = new Set((catTableRows || []).map((r) => r.table_name));
  const targetTable = present.has('materials_categories')
    ? 'materials_categories'
    : present.has('inventory_categories')
      ? 'inventory_categories'
      : null;

  if (!targetTable) {
    console.log(
      '⚠️  No materials_categories or inventory_categories; skipping businessType / studioType / shopType migration.'
    );
    if (closeConnection) await sequelize.close();
    return;
  }

  console.log(`Adding businessType, studioType, shopType to ${targetTable}...`);

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
      DO $$ BEGIN
        CREATE TYPE "enum_materials_categories_businessType" AS ENUM ('shop', 'studio', 'pharmacy');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    await sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_materials_categories_studioType" AS ENUM ('printing_press', 'mechanic', 'barber', 'salon');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    const businessEnum =
      targetTable === 'materials_categories'
        ? 'enum_materials_categories_businessType'
        : 'enum_inventory_categories_businessType';
    const studioEnum =
      targetTable === 'materials_categories'
        ? 'enum_materials_categories_studioType'
        : 'enum_inventory_categories_studioType';

    await sequelize.query(`
      ALTER TABLE "${targetTable}"
      ADD COLUMN IF NOT EXISTS "businessType" "${businessEnum}";
    `);

    await sequelize.query(`
      ALTER TABLE "${targetTable}"
      ADD COLUMN IF NOT EXISTS "studioType" "${studioEnum}";
    `);

    await sequelize.query(`
      ALTER TABLE "${targetTable}"
      ADD COLUMN IF NOT EXISTS "shopType" VARCHAR(50);
    `);

    console.log(`Added businessType, studioType, shopType to ${targetTable}`);

    if (closeConnection) {
      await sequelize.close();
    }
  } catch (error) {
    console.error(`Error adding business type columns to ${targetTable}:`, error);
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
