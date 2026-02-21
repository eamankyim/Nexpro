const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');

/**
 * Add Paystack subaccount code to tenants for POS payment splits
 * Money flows to each tenant's bank account via Paystack subaccount
 */
async function up() {
  console.log('Adding paystackSubaccountCode to tenants...');

  await sequelize.query(`
    ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS "paystackSubaccountCode" VARCHAR(100);
  `);

  console.log('[Migration] Paystack subaccount column added to tenants');
}

async function down() {
  console.log('Removing paystackSubaccountCode from tenants...');
  await sequelize.query(`
    ALTER TABLE tenants
    DROP COLUMN IF EXISTS "paystackSubaccountCode";
  `);
  console.log('[Migration] Paystack subaccount column removed from tenants');
}

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
