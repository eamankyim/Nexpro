const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');

const addBusinessTypeToTenants = async () => {
  console.log('🏗️  Adding businessType column to tenants table...');
  const transaction = await sequelize.transaction();

  try {
    // Create ENUM type for business types
    console.log('📝 Creating business_type enum...');
    await sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'business_type_enum') THEN
          CREATE TYPE business_type_enum AS ENUM ('printing_press', 'shop', 'pharmacy');
        END IF;
      END
      $$;
    `, { transaction });

    // Add businessType column
    console.log('➕ Adding businessType column...');
    await sequelize.query(`
      ALTER TABLE tenants
      ADD COLUMN IF NOT EXISTS "businessType" business_type_enum;
    `, { transaction });

    // Set default value for existing tenants (printing_press)
    console.log('🔄 Setting default businessType for existing tenants...');
    await sequelize.query(`
      UPDATE tenants
      SET "businessType" = 'printing_press'
      WHERE "businessType" IS NULL;
    `, { transaction });

    // Create index on businessType for faster queries
    console.log('📊 Creating index on businessType...');
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS tenants_business_type_idx ON tenants("businessType");
    `, { transaction });

    await transaction.commit();
    console.log('✅ Business type column added successfully!');
  } catch (error) {
    if (transaction) {
      await transaction.rollback();
    }
    console.error('💥 Failed to add business type column:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
};

// Run migration if called directly
if (require.main === module) {
  addBusinessTypeToTenants()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = addBusinessTypeToTenants;
