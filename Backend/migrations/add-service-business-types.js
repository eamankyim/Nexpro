/**
 * Migration: Add service business types (mechanic, barber, salon) to business_type_enum
 *
 * These types use the same Job/Quote/Invoice flow as printing_press.
 * Note: ALTER TYPE ... ADD VALUE cannot run inside a transaction in PostgreSQL.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');

const addServiceBusinessTypes = async (options = {}) => {
  const { closeConnection = true } = options;
  console.log('🏗️  Adding mechanic, barber, salon to business_type_enum...');

  try {
    // Add new enum values (IF NOT EXISTS requires PostgreSQL 9.1+)
    await sequelize.query(`
      ALTER TYPE business_type_enum ADD VALUE IF NOT EXISTS 'mechanic';
    `);
    await sequelize.query(`
      ALTER TYPE business_type_enum ADD VALUE IF NOT EXISTS 'barber';
    `);
    await sequelize.query(`
      ALTER TYPE business_type_enum ADD VALUE IF NOT EXISTS 'salon';
    `);

    console.log('✅ Service business types added successfully!');
  } catch (error) {
    console.error('💥 Failed to add service business types:', error);
    throw error;
  } finally {
    if (closeConnection) {
      await sequelize.close();
    }
  }
};

// Run migration if called directly
if (require.main === module) {
  addServiceBusinessTypes({ closeConnection: true })
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = addServiceBusinessTypes;
