const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize, testConnection } = require('../config/database');

const addOrderStatusToSales = async () => {
  const isDirect = require.main === module;
  try {
    console.log('🔄 Adding orderStatus column to sales table...\n');
    if (isDirect) await testConnection();

    const [columnInfo] = await sequelize.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'sales' AND column_name = 'orderStatus';
    `);

    if (columnInfo.length > 0) {
      console.log('✅ Column orderStatus already exists on sales.');
    } else {
      await sequelize.query(`
        ALTER TABLE sales
        ADD COLUMN "orderStatus" VARCHAR(20);
      `);
      console.log('✅ Column orderStatus added to sales.');
    }

    console.log('✅ add-orderStatus-to-sales migration completed.\n');
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
  addOrderStatusToSales();
}

module.exports = addOrderStatusToSales;
