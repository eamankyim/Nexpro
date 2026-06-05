const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize, testConnection } = require('../config/database');

const allowNullProductIdOnSaleItems = async () => {
  const isDirect = require.main === module;
  try {
    console.log('🔄 Allowing nullable productId on sale_items...\n');
    if (isDirect) await testConnection();

    await sequelize.query(`
      ALTER TABLE sale_items
      ALTER COLUMN "productId" DROP NOT NULL;
    `);

    console.log('✅ sale_items.productId is nullable.\n');
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
  allowNullProductIdOnSaleItems();
}

module.exports = allowNullProductIdOnSaleItems;
