const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

/**
 * Add Sabito integration fields to customers table
 */

async function up() {
  const queryInterface = sequelize.getQueryInterface();

  console.log('Adding Sabito fields to customers table...');
  
  await queryInterface.addColumn('customers', 'sabito_customer_id', {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Sabito customer ID for integration'
  });

  await queryInterface.addColumn('customers', 'sabito_source_referral_id', {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Sabito referral ID that led to this customer'
  });

  await queryInterface.addColumn('customers', 'sabito_source_type', {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: 'standalone',
    comment: 'Source type: referral, direct, standalone'
  });

  await queryInterface.addColumn('customers', 'sabito_business_id', {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Sabito business ID'
  });

  // Add indexes for faster lookups
  await queryInterface.addIndex('customers', ['sabito_customer_id'], {
    name: 'idx_customers_sabito_customer_id',
    unique: false
  });

  await queryInterface.addIndex('customers', ['sabito_source_referral_id'], {
    name: 'idx_customers_sabito_referral_id',
    unique: false
  });

  await queryInterface.addIndex('customers', ['sabito_business_id'], {
    name: 'idx_customers_sabito_business_id',
    unique: false
  });

  console.log('[Migration] Sabito customer fields added successfully!');
}

async function down() {
  const queryInterface = sequelize.getQueryInterface();

  console.log('Removing Sabito customer fields...');
  
  await queryInterface.removeIndex('customers', 'idx_customers_sabito_business_id');
  await queryInterface.removeIndex('customers', 'idx_customers_sabito_referral_id');
  await queryInterface.removeIndex('customers', 'idx_customers_sabito_customer_id');
  
  await queryInterface.removeColumn('customers', 'sabito_business_id');
  await queryInterface.removeColumn('customers', 'sabito_source_type');
  await queryInterface.removeColumn('customers', 'sabito_source_referral_id');
  await queryInterface.removeColumn('customers', 'sabito_customer_id');
  
  console.log('[Migration] Sabito customer fields removed');
}

// Run migration if called directly
if (require.main === module) {
  up()
    .then(() => {
      console.log('Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { up, down };






