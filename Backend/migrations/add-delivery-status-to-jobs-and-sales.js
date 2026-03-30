const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize, testConnection } = require('../config/database');

const addDeliveryStatusToJobsAndSales = async () => {
  const isDirect = require.main === module;
  try {
    console.log('🔄 Adding deliveryStatus to jobs and sales...\n');
    if (isDirect) await testConnection();

    const [jobCol] = await sequelize.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'jobs' AND column_name = 'deliveryStatus';
    `);
    if (jobCol.length === 0) {
      await sequelize.query(`
        ALTER TABLE jobs ADD COLUMN "deliveryStatus" VARCHAR(32);
      `);
      console.log('✅ Column deliveryStatus added to jobs.');
    } else {
      console.log('✅ Column deliveryStatus already exists on jobs.');
    }

    const [saleCol] = await sequelize.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'sales' AND column_name = 'deliveryStatus';
    `);
    if (saleCol.length === 0) {
      await sequelize.query(`
        ALTER TABLE sales ADD COLUMN "deliveryStatus" VARCHAR(32);
      `);
      console.log('✅ Column deliveryStatus added to sales.');
    } else {
      console.log('✅ Column deliveryStatus already exists on sales.');
    }

    console.log('✅ add-delivery-status-to-jobs-and-sales migration completed.\n');
    if (isDirect) {
      await sequelize.close();
      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    if (isDirect) {
      await sequelize.close();
      process.exit(1);
    }
    throw error;
  }
};

if (require.main === module) {
  addDeliveryStatusToJobsAndSales();
}

module.exports = addDeliveryStatusToJobsAndSales;
