const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize, testConnection } = require('../config/database');

const addDeliveryRequiredToJobs = async () => {
  const isDirect = require.main === module;
  try {
    console.log('🔄 Adding deliveryRequired to jobs...\n');
    if (isDirect) await testConnection();

    const [cols] = await sequelize.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'jobs' AND column_name = 'deliveryRequired';
    `);
    if (cols.length === 0) {
      await sequelize.query(`
        ALTER TABLE jobs ADD COLUMN "deliveryRequired" BOOLEAN NOT NULL DEFAULT false;
      `);
      console.log('✅ Column deliveryRequired added to jobs.');
      await sequelize.query(`
        UPDATE jobs SET "deliveryRequired" = true WHERE "deliveryStatus" IS NOT NULL;
      `);
      console.log('✅ Backfilled deliveryRequired for jobs with a delivery stage set.');
    } else {
      console.log('✅ Column deliveryRequired already exists on jobs.');
    }

    console.log('✅ add-delivery-required-to-jobs migration completed.\n');
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
  addDeliveryRequiredToJobs();
}

module.exports = addDeliveryRequiredToJobs;
