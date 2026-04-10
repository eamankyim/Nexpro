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
const addClientIdToSales = require('./add-clientId-to-sales');
const createProductCategoriesAndSwitchProducts = require('./create-product-categories-and-switch-products');
const addBusinessTypeToProductCategories = require('./add-business-type-to-product-categories');
const addShopTypeToProductCategories = require('./add-shop-type-to-product-categories');
const addBusinessTypeToInventoryCategories = require('./add-business-type-to-inventory-categories');
const seedDefaultProductCategories = require('./seed-default-product-categories');
const backfillCategoriesForExistingTenants = require('./backfill-categories-for-existing-tenants');
const addEmailPhoneUniqueConstraints = require('./add-email-phone-unique-constraints');
const fixUniquenessPerTenant = require('./fix-uniqueness-per-tenant');
const renameInventoryTablesToMaterials = require('./rename-inventory-tables-to-materials');
const addPartiallyPaidToSalesStatus = require('./add-partially-paid-to-sales-status');
const addQuoteInvoiceSaleFlow = require('./add-quote-invoice-sale-flow');
const addViewTokenToQuotes = require('./add-view-token-to-quotes');
const addViewTokenToJobs = require('./add-view-token-to-jobs');
const allowNullTenantIdInSettings = require('./allow-null-tenantId-in-settings');
const addInviteEmailStatusFields = require('./add-invite-email-status-fields');
const addNotificationPreferencesToUsers = require('./add-notification-preferences-to-users');
const addTaxToQuotes = require('./add-tax-to-quotes');
const addJobQueryIndexes = require('./add-job-query-indexes');
const addTaskAutomationFieldsToUserTasks = require('./add-task-automation-fields-to-user-tasks');
const addMetadataToUserTasks = require('./add-metadata-to-user-tasks');
const addStartDateToUserTasks = require('./add-startDate-to-user-tasks');
const createTenantAccessAudits = require('./create-tenant-access-audits');
const createAutomationsTables = require('./create-automations-tables');
const normalizeTenantPlansToTrial = require('./normalize-tenant-plans-to-trial');
const addDeliveryStatusToJobsAndSales = require('./add-delivery-status-to-jobs-and-sales');
const addDeliveryRequiredToJobs = require('./add-delivery-required-to-jobs');
const addSalesTenantSoldByCreatedIndex = require('./add-sales-tenant-soldby-created-index');
const addQueryPathIndexesV2 = require('./add-query-path-indexes-v2');

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

    // Add clientId column for offline sale idempotency (safe if already exists)
    await addClientIdToSales();

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

    // Allow NULL tenantId for platform-wide settings (platform:branding, platform:featureFlags, etc.)
    await allowNullTenantIdInSettings();

    // Create invite_tokens table if it doesn't exist
    await createInviteTokens.up(sequelize.getQueryInterface(), require('sequelize'));

    // Create password_reset_tokens table if it doesn't exist
    await createPasswordResetTokens.up(sequelize.getQueryInterface(), require('sequelize'));

    // Create email_verification_tokens table if it doesn't exist
    await createEmailVerificationTokens.up(sequelize.getQueryInterface(), require('sequelize'));

    // Add email_verified_at to users if it doesn't exist
    await addEmailVerifiedAtToUsers.up();

    // Add partially_paid to sales status enum
    const queryInterface = sequelize.getQueryInterface();
    await addPartiallyPaidToSalesStatus.up(queryInterface);

    // Quote → invoice → sale flow (quoteId on invoices, productId on quote_items)
    await addQuoteInvoiceSaleFlow();

    // Add viewToken to quotes for public quote viewing
    await addViewTokenToQuotes();

    // Add viewToken to jobs for customer job tracking links
    await addViewTokenToJobs();

    // Add invite email delivery status fields
    await addInviteEmailStatusFields();

    // Per-user notification preference JSON on users
    await addNotificationPreferencesToUsers.up();

    // Quote tax columns (tenant tax configuration)
    await addTaxToQuotes();

    // Jobs list/search indexes
    await addJobQueryIndexes();

    // Workspace task automation metadata columns
    await addTaskAutomationFieldsToUserTasks();
    await addMetadataToUserTasks.up();
    await addStartDateToUserTasks.up();

    // Tenant access audit trail
    await createTenantAccessAudits.up();

    // Automations V1 tables
    await createAutomationsTables.up({ closeConnection: false });

    // Normalize all tenant plan values to canonical trial
    await normalizeTenantPlansToTrial.up({ closeConnection: false });

    // First-party delivery tracking (jobs + sales)
    await addDeliveryStatusToJobsAndSales();

    // Job flag: customer delivery required (vs optional); stages still set on Deliveries
    await addDeliveryRequiredToJobs();

    // Sales list for staff (tenant + soldBy + recency)
    await addSalesTenantSoldByCreatedIndex();

    // Additional endpoint-driven indexes (sales/invoices/jobs)
    await addQueryPathIndexesV2();

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

