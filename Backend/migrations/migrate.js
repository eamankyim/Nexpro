const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize, testConnection } = require('../config/database');
const models = require('../models');
const addUserFields = require('./add-user-fields');
const createInviteTokens = require('./create-invite-tokens');
const updateJobStatuses = require('./update-job-statuses');
const updateVendorPriceListImageUrl = require('./update-vendor-price-list-image-url');
const updateFileStorageToText = require('./update-file-storage-to-text');
const addCreatedByToLeads = require('./add-createdBy-to-leads');
const addIsArchivedToExpenses = require('./add-isArchived-to-expenses');
const fixExpenseNumberUniqueConstraint = require('./fix-expense-number-unique-constraint');
const addPerformanceIndexes = require('./add-performance-indexes');
const addImageUrlToProducts = require('./add-imageUrl-to-products');
const alterProductsImageUrlToText = require('./alter-products-imageUrl-to-text');
const createProductCategoriesAndSwitchProducts = require('./create-product-categories-and-switch-products');

const migrate = async () => {
  try {
    console.log('🔄 Starting database migration...\n');
    
    // Test database connection
    await testConnection();
    
    // Update job status enum values (safe if enum doesn't exist yet)
    await updateJobStatuses();
    
    // Skip sequelize.sync() - it generates invalid PostgreSQL ALTERs (ENUM+comment,
    // unique-in-TYPE). Rely on explicit migrations below. For new DBs, run schema
    // creation (e.g. create-tenants-schema, create-inventory-tables) first.

    // Add new user fields if they don't exist
    await addUserFields();
    
    // Update vendor price list imageUrl to TEXT
    await updateVendorPriceListImageUrl();
    
    // Update file storage columns to TEXT
    await updateFileStorageToText();
    
    // Add createdBy column to leads table if it doesn't exist
    await addCreatedByToLeads();
    
    // Add isArchived column to expenses table if it doesn't exist
    await addIsArchivedToExpenses();
    
    // Make expenseNumber unique per tenant (not globally)
    await fixExpenseNumberUniqueConstraint();
    
    // Add performance indexes for query optimization
    await addPerformanceIndexes();
    
    // Add imageUrl column to products table if it doesn't exist
    await addImageUrlToProducts();

    // Alter products.imageUrl to TEXT (for base64 in serverless)
    await alterProductsImageUrlToText();

    // Create product_categories, migrate product refs from inventory_categories, switch FK
    await createProductCategoriesAndSwitchProducts();
    
    // Create invite_tokens table if it doesn't exist
    await createInviteTokens.up(sequelize.getQueryInterface(), require('sequelize'));
    
    console.log('\n✅ Database migration completed successfully!');
    console.log('📊 Incremental schema updates applied.');
    console.log('👤 User model has been enhanced with new fields.');
    console.log('🎫 Invite tokens table ready.');
    console.log('⚡ Performance indexes created.\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
};

migrate();

