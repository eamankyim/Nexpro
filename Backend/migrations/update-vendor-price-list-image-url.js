const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize, testConnection } = require('../config/database');

const updateVendorPriceListImageUrl = async () => {
  try {
    console.log('🔄 Updating vendor_price_lists.imageUrl column to TEXT...\n');
    
    // Test database connection
    await testConnection();
    
    // Check if column exists and its current type
    const [columnInfo] = await sequelize.query(`
      SELECT 
        column_name,
        data_type,
        character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'vendor_price_lists' 
      AND column_name = 'imageUrl';
    `);
    
    if (columnInfo.length === 0) {
      console.log('⚠️  Column imageUrl does not exist. Creating it as TEXT...');
      await sequelize.query(`
        ALTER TABLE vendor_price_lists
        ADD COLUMN "imageUrl" TEXT;
      `);
      console.log('✅ Column created as TEXT');
    } else {
      const currentType = columnInfo[0].data_type;
      const maxLength = columnInfo[0].character_maximum_length;
      
      console.log(`📊 Current column type: ${currentType}${maxLength ? `(${maxLength})` : ''}`);
      
      if (currentType === 'character varying' || (currentType === 'text' && maxLength)) {
        console.log('🔄 Altering column to TEXT...');
        await sequelize.query(`
          ALTER TABLE vendor_price_lists
          ALTER COLUMN "imageUrl" TYPE TEXT;
        `);
        console.log('✅ Column successfully altered to TEXT');
      } else if (currentType === 'text' && !maxLength) {
        console.log('✅ Column is already TEXT, no changes needed');
      } else {
        console.log(`⚠️  Column type is ${currentType}, converting to TEXT...`);
        await sequelize.query(`
          ALTER TABLE vendor_price_lists
          ALTER COLUMN "imageUrl" TYPE TEXT USING "imageUrl"::TEXT;
        `);
        console.log('✅ Column successfully converted to TEXT');
      }
    }
    
    console.log('\n✅ Migration completed successfully!');
    console.log('📸 vendor_price_lists.imageUrl is now TEXT and can store base64 images.\n');
    
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    await sequelize.close();
    process.exit(1);
  }
};

// Run the migration if called directly
if (require.main === module) {
  updateVendorPriceListImageUrl();
}

module.exports = updateVendorPriceListImageUrl;


