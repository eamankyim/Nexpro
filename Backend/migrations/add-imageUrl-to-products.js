const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize, testConnection } = require('../config/database');

const addImageUrlToProducts = async () => {
  const isDirect = require.main === module;
  try {
    console.log('🔄 Adding imageUrl column to products table...\n');
    if (isDirect) await testConnection();

    const [columnInfo] = await sequelize.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'products' AND column_name = 'imageUrl';
    `);

    if (columnInfo.length > 0) {
      console.log('✅ Column imageUrl already exists on products.');
    } else {
      await sequelize.query(`
        ALTER TABLE products
        ADD COLUMN "imageUrl" VARCHAR(2048);
      `);
      console.log('✅ Column imageUrl added to products.');
    }

    console.log('✅ add-imageUrl-to-products migration completed.\n');
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
  addImageUrlToProducts();
}

module.exports = addImageUrlToProducts;
