const { sequelize, testConnection } = require('../config/database');
const models = require('../models');
const addUserFields = require('./add-user-fields');

const migrate = async () => {
  try {
    console.log('🔄 Starting database migration...\n');
    
    // Test database connection
    await testConnection();
    
    // Sync all models with database
    // force: false means it won't drop existing tables
    // alter: true means it will modify existing tables to match models
    await sequelize.sync({ alter: true });
    
    // Add new user fields if they don't exist
    await addUserFields();
    
    console.log('\n✅ Database migration completed successfully!');
    console.log('📊 All tables have been created/updated.');
    console.log('👤 User model has been enhanced with new fields.\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
};

migrate();

