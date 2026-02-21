/**
 * Add tenantId index to customers table for faster tenant-scoped queries
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');

const addTenantIndexToCustomers = async () => {
  console.log('Adding tenantId index to customers...');
  try {
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS customers_tenantId_idx ON customers("tenantId");
    `);
    console.log('Customers tenantId index created');
  } catch (error) {
    if (error.message && error.message.includes('already exists')) {
      console.log('Index may already exist, skipping');
    } else {
      throw error;
    }
  }
};

if (require.main === module) {
  addTenantIndexToCustomers()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

module.exports = addTenantIndexToCustomers;
