const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize, testConnection } = require('../config/database');

const addTrackStockToProducts = async () => {
  const isDirect = require.main === module;
  try {
    console.log('🔄 Adding trackStock column to products and product_variants...\n');
    if (isDirect) await testConnection();

    const [productsColumnInfo] = await sequelize.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'products' AND column_name = 'trackStock';
    `);

    if (productsColumnInfo.length > 0) {
      console.log('✅ Column trackStock already exists on products.');
    } else {
      await sequelize.query(`
        ALTER TABLE products
        ADD COLUMN "trackStock" BOOLEAN NOT NULL DEFAULT true;
      `);
      console.log('✅ Column trackStock added to products.');
    }

    const [variantsColumnInfo] = await sequelize.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'product_variants' AND column_name = 'trackStock';
    `);

    if (variantsColumnInfo.length > 0) {
      console.log('✅ Column trackStock already exists on product_variants.');
    } else {
      await sequelize.query(`
        ALTER TABLE product_variants
        ADD COLUMN "trackStock" BOOLEAN DEFAULT true;
      `);
      console.log('✅ Column trackStock added to product_variants.');
    }

    console.log('✅ add-trackStock-to-products migration completed.\n');
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
  addTrackStockToProducts();
}

module.exports = addTrackStockToProducts;
