const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

const addInvoiceSourceTypes = async () => {
  console.log('🚀 Starting invoice source types migration...');
  const transaction = await sequelize.transaction();

  try {
    console.log('🔐 Ensuring pgcrypto extension is available...');
    await sequelize.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`, { transaction });

    // Create source_type enum if it doesn't exist
    console.log('📝 Creating source_type enum...');
    await sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_source_type_enum') THEN
          CREATE TYPE invoice_source_type_enum AS ENUM ('job', 'sale', 'prescription', 'quote');
        END IF;
      END
      $$;
    `, { transaction });

    // Make jobId nullable (it was previously NOT NULL)
    console.log('🔄 Making jobId nullable...');
    await sequelize.query(`
      ALTER TABLE invoices
      ALTER COLUMN "jobId" DROP NOT NULL;
    `, { transaction });

    // Add saleId column
    console.log('➕ Adding saleId column...');
    await sequelize.query(`
      ALTER TABLE invoices
      ADD COLUMN IF NOT EXISTS "saleId" UUID REFERENCES sales(id) ON UPDATE CASCADE ON DELETE SET NULL;
    `, { transaction });

    // Add prescriptionId column
    console.log('➕ Adding prescriptionId column...');
    await sequelize.query(`
      ALTER TABLE invoices
      ADD COLUMN IF NOT EXISTS "prescriptionId" UUID REFERENCES prescriptions(id) ON UPDATE CASCADE ON DELETE SET NULL;
    `, { transaction });

    // Add sourceType column
    console.log('➕ Adding sourceType column...');
    await sequelize.query(`
      ALTER TABLE invoices
      ADD COLUMN IF NOT EXISTS "sourceType" invoice_source_type_enum NOT NULL DEFAULT 'job';
    `, { transaction });

    // Create indexes
    console.log('📊 Creating indexes...');
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS invoices_sale_id_idx ON invoices("saleId");
    `, { transaction });

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS invoices_prescription_id_idx ON invoices("prescriptionId");
    `, { transaction });

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS invoices_source_type_idx ON invoices("sourceType");
    `, { transaction });

    // Update existing invoices to have sourceType = 'job'
    console.log('🔄 Updating existing invoices...');
    await sequelize.query(`
      UPDATE invoices
      SET "sourceType" = 'job'
      WHERE "sourceType" IS NULL OR "jobId" IS NOT NULL;
    `, { transaction });

    await transaction.commit();
    console.log('✅ Invoice source types migration completed successfully!');
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Error during migration:', error);
    throw error;
  }
};

// Run migration if called directly
if (require.main === module) {
  addInvoiceSourceTypes()
    .then(() => {
      console.log('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = addInvoiceSourceTypes;
