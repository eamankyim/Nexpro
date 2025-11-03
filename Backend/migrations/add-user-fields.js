const { sequelize } = require('../config/database');

const addUserFields = async () => {
  try {
    console.log('🔄 Adding new fields to User model...');
    
    // Add profilePicture field
    await sequelize.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS "profilePicture" TEXT;
    `);
    
    // Add isFirstLogin field
    await sequelize.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS "isFirstLogin" BOOLEAN DEFAULT true;
    `);
    
    // Add lastLogin field
    await sequelize.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS "lastLogin" TIMESTAMP;
    `);
    
    // Update existing users to have isFirstLogin = false (they've already logged in)
    await sequelize.query(`
      UPDATE users 
      SET "isFirstLogin" = false 
      WHERE "isFirstLogin" IS NULL;
    `);
    
    console.log('✅ User model fields added successfully!');
    console.log('📋 Added fields:');
    console.log('   - profilePicture (TEXT for base64 images)');
    console.log('   - isFirstLogin (BOOLEAN, default: true)');
    console.log('   - lastLogin (TIMESTAMP)');
    
  } catch (error) {
    console.error('❌ Error adding user fields:', error);
    throw error;
  }
};

// Run migration if called directly
if (require.main === module) {
  addUserFields()
    .then(() => {
      console.log('🎉 Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

module.exports = addUserFields;
