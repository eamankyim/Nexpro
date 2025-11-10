const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize, testConnection } = require('../config/database');
const models = require('../models');
const addUserFields = require('./add-user-fields');
const createInviteTokens = require('./create-invite-tokens');
const updateJobStatuses = require('./update-job-statuses');

const migrate = async () => {
  try {
    console.log('🔄 Starting database migration...\n');
    
    // Test database connection
    await testConnection();
    
    // Update job status enum values before syncing models (safe if enum doesn't exist yet)
    await updateJobStatuses();
    
    // Sync all models with database
    // force: false means it won't drop existing tables
    // alter: true means it will modify existing tables to match models
    await sequelize.sync({ alter: true });
    
    // Add new user fields if they don't exist
    await addUserFields();
    
    // Create invite_tokens table if it doesn't exist
    await createInviteTokens.up(sequelize.getQueryInterface(), require('sequelize'));
    
    console.log('\n✅ Database migration completed successfully!');
    console.log('📊 All tables have been created/updated.');
    console.log('👤 User model has been enhanced with new fields.');
    console.log('🎫 Invite tokens table ready.\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
};

migrate();

