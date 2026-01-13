const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

/**
 * Add Sabito integration fields to invoices table
 */

async function up() {
  const queryInterface = sequelize.getQueryInterface();

  console.log('Adding Sabito fields to invoices table...');
  
  await queryInterface.addColumn('invoices', 'sabito_project_id', {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Sabito project ID created when invoice is synced'
  });

  await queryInterface.addColumn('invoices', 'sabito_synced_at', {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Timestamp when invoice was synced to Sabito'
  });

  await queryInterface.addColumn('invoices', 'sabito_sync_status', {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: 'pending',
    comment: 'Sync status: pending, synced, failed, skipped'
  });

  await queryInterface.addColumn('invoices', 'sabito_sync_error', {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Error message if sync failed'
  });

  // Add indexes
  await queryInterface.addIndex('invoices', ['sabito_project_id'], {
    name: 'idx_invoices_sabito_project_id',
    unique: false
  });

  await queryInterface.addIndex('invoices', ['sabito_sync_status'], {
    name: 'idx_invoices_sabito_sync_status',
    unique: false
  });

  console.log('[Migration] Sabito invoice fields added successfully!');
}

async function down() {
  const queryInterface = sequelize.getQueryInterface();

  console.log('Removing Sabito invoice fields...');
  
  await queryInterface.removeIndex('invoices', 'idx_invoices_sabito_sync_status');
  await queryInterface.removeIndex('invoices', 'idx_invoices_sabito_project_id');
  
  await queryInterface.removeColumn('invoices', 'sabito_sync_error');
  await queryInterface.removeColumn('invoices', 'sabito_sync_status');
  await queryInterface.removeColumn('invoices', 'sabito_synced_at');
  await queryInterface.removeColumn('invoices', 'sabito_project_id');
  
  console.log('[Migration] Sabito invoice fields removed');
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






