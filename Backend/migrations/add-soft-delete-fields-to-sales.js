const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize, testConnection } = require('../config/database');
const { QueryTypes } = require('sequelize');

/**
 * Adds soft-delete columns to sales: deletedAt/deletedBy/deletionReason.
 * Manager/staff soft-delete a paid sale (hidden from the Sales list, kept for audit and
 * accounting integrity — journal entries and stock movements are untouched). Admins keep
 * the existing hard-delete (permanently destroys the sale row). No backfill needed: existing
 * sales keep deletedAt = NULL, i.e. not deleted.
 */
const addSoftDeleteFieldsToSales = async () => {
  const isDirect = require.main === module;
  try {
    console.log('🔄 add-soft-delete-fields-to-sales...\n');
    if (isDirect) await testConnection();

    const rows = await sequelize.query(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'sales' LIMIT 1`,
      { type: QueryTypes.SELECT }
    );
    if (!rows.length) {
      console.log('  ⏭️  Skipping sales (table does not exist)');
      if (isDirect) process.exit(0);
      return;
    }

    console.log('  ➡️  Adding sales.deletedAt, .deletedBy, and .deletionReason...');
    await sequelize.query(`
      ALTER TABLE sales
      ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP WITH TIME ZONE;
    `);
    await sequelize.query(`
      ALTER TABLE sales
      ADD COLUMN IF NOT EXISTS "deletedBy" UUID REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;
    `);
    await sequelize.query(`
      ALTER TABLE sales
      ADD COLUMN IF NOT EXISTS "deletionReason" TEXT;
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_sales_deleted_at ON sales ("deletedAt");
    `);

    console.log('✅ add-soft-delete-fields-to-sales completed.\n');
    if (isDirect) process.exit(0);
  } catch (error) {
    console.error('❌ add-soft-delete-fields-to-sales failed:', error);
    if (isDirect) process.exit(1);
    throw error;
  }
};

if (require.main === module) {
  addSoftDeleteFieldsToSales();
}

module.exports = addSoftDeleteFieldsToSales;
