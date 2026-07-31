const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');

/**
 * Link platform ops assets to platform customers.
 * @param {{ closeConnection?: boolean }} [options]
 */
const addCustomerIdToPlatformOpsAssets = async (options = {}) => {
  const { closeConnection = true } = options;
  console.log('Adding customerId to platform_ops_assets...');
  const transaction = await sequelize.transaction();

  try {
    await sequelize.query(`
      ALTER TABLE platform_ops_assets
        ADD COLUMN IF NOT EXISTS "customerId" UUID NULL
          REFERENCES customers(id) ON DELETE SET NULL ON UPDATE CASCADE;
    `, { transaction });

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS platform_ops_assets_customer_id_idx
        ON platform_ops_assets ("customerId");
    `, { transaction });

    await transaction.commit();
    console.log('customerId column added to platform_ops_assets.');
  } catch (error) {
    await transaction.rollback();
    console.error('Failed to add customerId to platform_ops_assets:', error);
    throw error;
  } finally {
    if (closeConnection) {
      await sequelize.close().catch(() => {});
    }
  }
};

if (require.main === module) {
  addCustomerIdToPlatformOpsAssets()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

module.exports = addCustomerIdToPlatformOpsAssets;
module.exports.up = addCustomerIdToPlatformOpsAssets;
