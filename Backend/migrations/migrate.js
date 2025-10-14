const { sequelize, testConnection } = require('../config/database');
const models = require('../models');

const migrate = async () => {
  try {
    console.log('🔄 Starting database migration...\n');
    
    // Test database connection
    await testConnection();
    
    // Sync all models with database
    // force: false means it won't drop existing tables
    // alter: true means it will modify existing tables to match models
    await sequelize.sync({ alter: true });
    
    console.log('\n✅ Database migration completed successfully!');
    console.log('📊 All tables have been created/updated.\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
};

migrate();

