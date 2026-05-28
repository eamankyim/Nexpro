const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize, testConnection } = require('../config/database');

const backfillJobInvoiceStudioLocations = async ({ closeConnection = true } = {}) => {
  const isDirect = require.main === module;
  try {
    console.log('backfill-job-invoice-studio-locations...');
    if (isDirect) await testConnection();

    const [result] = await sequelize.query(`
      UPDATE invoices i
      SET "studioLocationId" = j."studioLocationId"
      FROM jobs j
      WHERE i."jobId" = j.id
        AND i."tenantId" = j."tenantId"
        AND i."studioLocationId" IS NULL
        AND j."studioLocationId" IS NOT NULL
      RETURNING i.id;
    `);

    console.log(`backfill-job-invoice-studio-locations completed. Updated ${result.length} invoices.`);

    if (isDirect && closeConnection) {
      await sequelize.close();
      process.exit(0);
    }
  } catch (error) {
    console.error('backfill-job-invoice-studio-locations failed:', error);
    if (isDirect) process.exit(1);
    throw error;
  }
};

if (require.main === module) {
  backfillJobInvoiceStudioLocations();
}

module.exports = backfillJobInvoiceStudioLocations;
