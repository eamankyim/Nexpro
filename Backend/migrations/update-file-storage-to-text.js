const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize, testConnection } = require('../config/database');

const updateFileStorageToText = async () => {
  try {
    console.log('🔄 Updating file storage columns to TEXT for base64 storage...\n');
    
    // Test database connection
    await testConnection();
    
    // Update employee_documents.fileUrl to TEXT
    console.log('📄 Updating employee_documents.fileUrl...');
    const [employeeDocInfo] = await sequelize.query(`
      SELECT 
        column_name,
        data_type,
        character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'employee_documents' 
      AND column_name = 'fileUrl';
    `);
    
    if (employeeDocInfo.length > 0) {
      const currentType = employeeDocInfo[0].data_type;
      const maxLength = employeeDocInfo[0].character_maximum_length;
      
      if (currentType === 'character varying' || (currentType === 'text' && maxLength)) {
        console.log(`   Current type: ${currentType}${maxLength ? `(${maxLength})` : ''}`);
        await sequelize.query(`
          ALTER TABLE employee_documents
          ALTER COLUMN "fileUrl" TYPE TEXT;
        `);
        console.log('   ✅ Updated to TEXT');
      } else {
        console.log('   ✅ Already TEXT');
      }
    } else {
      console.log('   ⚠️  Column does not exist');
    }
    
    console.log('\n✅ File storage migration completed successfully!');
    console.log('📁 All file storage columns are now TEXT and can store base64 data.\n');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    throw error;
  }
};

// Run the migration if called directly
if (require.main === module) {
  updateFileStorageToText()
    .then(async () => {
      await sequelize.close();
      process.exit(0);
    })
    .catch(async () => {
      try {
        await sequelize.close();
      } catch (_) {
        /* ignore */
      }
      process.exit(1);
    });
}

module.exports = updateFileStorageToText;


