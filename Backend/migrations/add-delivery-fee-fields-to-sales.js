const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize, testConnection } = require('../config/database');

const addColumnIfMissing = async (columnName, columnSql) => {
  const [columnInfo] = await sequelize.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = '${columnName}';
  `);

  if (columnInfo.length > 0) {
    console.log(`✅ Column ${columnName} already exists on sales.`);
    return;
  }

  await sequelize.query(`ALTER TABLE sales ADD COLUMN ${columnSql};`);
  console.log(`✅ Column ${columnName} added to sales.`);
};

const addDeliveryFeeFieldsToSales = async () => {
  const isDirect = require.main === module;
  try {
    console.log('🔄 Adding delivery fee fields to sales...\n');
    if (isDirect) await testConnection();

    await addColumnIfMissing('deliveryRequired', '"deliveryRequired" BOOLEAN NOT NULL DEFAULT false');
    await addColumnIfMissing('deliveryFee', '"deliveryFee" DECIMAL(12, 2) NOT NULL DEFAULT 0');
    await addColumnIfMissing('deliveryBandId', '"deliveryBandId" VARCHAR(255)');

    console.log('✅ add-delivery-fee-fields-to-sales migration completed.\n');
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
  addDeliveryFeeFieldsToSales();
}

module.exports = addDeliveryFeeFieldsToSales;
