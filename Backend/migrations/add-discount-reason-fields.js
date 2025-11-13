const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

/**
 * Add discountReason field to invoices and quotes for better transparency
 */

async function up() {
  const queryInterface = sequelize.getQueryInterface();

  console.log('Adding discountReason to invoices table...');
  
  await queryInterface.addColumn('invoices', 'discountReason', {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Reason or description for the discount (e.g., "Volume discount 10%")'
  });

  console.log('Adding discountReason to quotes table...');
  
  await queryInterface.addColumn('quotes', 'discountReason', {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Reason or description for the discount'
  });

  console.log('Adding discount fields to quote_items table...');
  
  await queryInterface.addColumn('quote_items', 'discountPercent', {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 0,
    comment: 'Discount percentage applied to this line item'
  });

  await queryInterface.addColumn('quote_items', 'discountReason', {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Reason for line-item discount'
  });

  console.log('[Migration] Discount reason fields added successfully!');
}

async function down() {
  const queryInterface = sequelize.getQueryInterface();

  console.log('Removing discount reason fields...');
  
  await queryInterface.removeColumn('invoices', 'discountReason');
  await queryInterface.removeColumn('quotes', 'discountReason');
  await queryInterface.removeColumn('quote_items', 'discountPercent');
  await queryInterface.removeColumn('quote_items', 'discountReason');
  
  console.log('[Migration] Discount reason fields removed');
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

