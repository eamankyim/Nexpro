const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize, testConnection } = require('../config/database');
const models = require('../models');
const addUserFields = require('./add-user-fields');
const createInviteTokens = require('./create-invite-tokens');
const createPasswordResetTokens = require('./create-password-reset-tokens');
const createEmailVerificationTokens = require('./create-email-verification-tokens');
const addEmailVerifiedAtToUsers = require('./add-email-verified-at-to-users');
const updateJobStatuses = require('./update-job-statuses');
const updateVendorPriceListImageUrl = require('./update-vendor-price-list-image-url');
const updateFileStorageToText = require('./update-file-storage-to-text');
const addCreatedByToLeads = require('./add-createdBy-to-leads');
const addIsArchivedToExpenses = require('./add-isArchived-to-expenses');
const fixExpenseNumberUniqueConstraint = require('./fix-expense-number-unique-constraint');
const addPerformanceIndexes = require('./add-performance-indexes');
const addNotificationsPerformanceIndexes = require('./add-notifications-performance-indexes');
const addImageUrlToProducts = require('./add-imageUrl-to-products');
const alterProductsImageUrlToText = require('./alter-products-imageUrl-to-text');
const addTrackStockToProducts = require('./add-trackStock-to-products');
const addOrderStatusToSales = require('./add-orderStatus-to-sales');
const createProductCategoriesAndSwitchProducts = require('./create-product-categories-and-switch-products');
const addBusinessTypeToProductCategories = require('./add-business-type-to-product-categories');
const addShopTypeToProductCategories = require('./add-shop-type-to-product-categories');
const addBusinessTypeToInventoryCategories = require('./add-business-type-to-inventory-categories');
const seedDefaultProductCategories = require('./seed-default-product-categories');
const backfillCategoriesForExistingTenants = require('./backfill-categories-for-existing-tenants');
const addEmailPhoneUniqueConstraints = require('./add-email-phone-unique-constraints');
const fixUniquenessPerTenant = require('./fix-uniqueness-per-tenant');
const renameInventoryTablesToMaterials = require('./rename-inventory-tables-to-materials');

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
    await addNotificationsPerformanceIndexes();
    
    // Add imageUrl column to products table if it doesn't exist
    await addImageUrlToProducts();

    // Alter products.imageUrl to TEXT (for base64 in serverless)
    await alterProductsImageUrlToText();

    // Add trackStock column for made-to-order products
    await addTrackStockToProducts();

    // Add orderStatus column for restaurant order tracking
    await addOrderStatusToSales();

    // Create product_categories, migrate product refs from inventory_categories, switch FK
    await createProductCategoriesAndSwitchProducts();
    
    // Add businessType and studioType to product_categories
    await addBusinessTypeToProductCategories({ closeConnection: false });

    // Add shopType to product_categories
    await addShopTypeToProductCategories({ closeConnection: false });

    // Add businessType, studioType, shopType to inventory_categories
    await addBusinessTypeToInventoryCategories({ closeConnection: false });
    
    // Seed default product categories for all tenants
    await seedDefaultProductCategories({ closeConnection: false });

    // Backfill inventory & product categories for existing tenants (materials + products by business/shop type)
    await backfillCategoriesForExistingTenants({ closeConnection: false });

    // Email case-insensitivity and global uniqueness for email/phone
    await addEmailPhoneUniqueConstraints();

    // Change global unique constraints to per-tenant (email/phone, invoiceNumber, quoteNumber, barcode, sku)
    await fixUniquenessPerTenant();

    // Rename inventory_* tables to materials_* for full materials/equipment consistency
    await renameInventoryTablesToMaterials.up();

    // Create invite_tokens table if it doesn't exist
    await createInviteTokens.up(sequelize.getQueryInterface(), require('sequelize'));

    // Create password_reset_tokens table if it doesn't exist
    await createPasswordResetTokens.up(sequelize.getQueryInterface(), require('sequelize'));

    // Create email_verification_tokens table if it doesn't exist
    await createEmailVerificationTokens.up(sequelize.getQueryInterface(), require('sequelize'));

    // Add email_verified_at to users if it doesn't exist
    await addEmailVerifiedAtToUsers.up();

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

