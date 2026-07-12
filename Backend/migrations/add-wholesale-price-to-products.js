const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize, testConnection } = require('../config/database');

/**
 * Add nullable wholesalePrice to products and product_variants (dealer baseline before retail).
 */
const addWholesalePriceToProducts = async (options = {}) => {
  const { closeConnection = require.main === module } = options;
  const isDirect = require.main === module;
  try {
    console.log('🔄 Adding wholesalePrice to products and product_variants...\n');
    if (isDirect) await testConnection();

    const [productsColumnInfo] = await sequelize.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'products' AND column_name = 'wholesalePrice';
    `);

    if (productsColumnInfo.length > 0) {
      console.log('✅ Column wholesalePrice already exists on products.');
    } else {
      await sequelize.query(`
        ALTER TABLE products
        ADD COLUMN "wholesalePrice" DECIMAL(12, 2) NULL;
      `);
      console.log('✅ Column wholesalePrice added to products.');
    }

    const [variantsColumnInfo] = await sequelize.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'product_variants' AND column_name = 'wholesalePrice';
    `);

    if (variantsColumnInfo.length > 0) {
      console.log('✅ Column wholesalePrice already exists on product_variants.');
    } else {
      await sequelize.query(`
        ALTER TABLE product_variants
        ADD COLUMN "wholesalePrice" DECIMAL(12, 2) NULL;
      `);
      console.log('✅ Column wholesalePrice added to product_variants.');
    }

    console.log('✅ add-wholesale-price-to-products migration completed.\n');
    if (closeConnection) {
      await sequelize.close();
    }
    if (isDirect) {
      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    if (closeConnection) {
      try {
        await sequelize.close();
      } catch (_) {
        /* ignore */
      }
    }
    if (isDirect) {
      process.exit(1);
    }
    throw error;
  }
};

if (require.main === module) {
  addWholesalePriceToProducts();
}

module.exports = addWholesalePriceToProducts;
