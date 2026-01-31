const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize, testConnection } = require('../config/database');

const alterProductsImageUrlToText = async () => {
  const isDirect = require.main === module;
  try {
    console.log('🔄 Altering products.imageUrl to TEXT (for base64 in serverless)...\n');
    if (isDirect) await testConnection();

    const [col] = await sequelize.query(`
      SELECT data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'products' AND column_name = 'imageUrl';
    `);

    if (col.length === 0) {
      console.log('⚠️  products.imageUrl does not exist; skipping.');
    } else {
      const { data_type, character_maximum_length } = col[0];
      if (data_type === 'text' && !character_maximum_length) {
        console.log('✅ products.imageUrl is already TEXT.');
      } else {
        await sequelize.query(`
          ALTER TABLE products
          ALTER COLUMN "imageUrl" TYPE TEXT USING "imageUrl"::TEXT;
        `);
        console.log('✅ products.imageUrl altered to TEXT.');
      }
    }

    console.log('✅ alter-products-imageUrl-to-text migration completed.\n');
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

if (require.main === module) alterProductsImageUrlToText();
module.exports = alterProductsImageUrlToText;
