const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

/**
 * Add storage limit and pricing columns to subscription_plans
 */

// Default storage limits per plan (in MB)
const DEFAULT_STORAGE_LIMITS = {
  trial: 1024,      // 1 GB
  launch: 10240,    // 10 GB
  scale: 51200,     // 50 GB
  enterprise: null  // Unlimited
};

// Storage expansion pricing per 100GB
const STORAGE_PRICING = {
  trial: null,      // Cannot add storage
  launch: 15,       // GHS 15 per 100GB
  scale: 12,        // GHS 12 per 100GB (volume discount)
  enterprise: null  // Custom pricing
};

async function up() {
  const queryInterface = sequelize.getQueryInterface();

  console.log('Adding storage limit columns to subscription_plans...');

  // Add storageLimitMB column
  await queryInterface.addColumn('subscription_plans', 'storageLimitMB', {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Maximum storage in megabytes (null = unlimited)'
  });

  // Add storagePrice100GB column
  await queryInterface.addColumn('subscription_plans', 'storagePrice100GB', {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: 'Price per additional 100GB of storage'
  });

  console.log('Updating existing plans with default storage limits...');

  // Update each plan with storage limits
  await sequelize.query(`
    UPDATE subscription_plans 
    SET "storageLimitMB" = :limit, "storagePrice100GB" = :price
    WHERE "planId" = 'trial'
  `, {
    replacements: { 
      limit: DEFAULT_STORAGE_LIMITS.trial,
      price: STORAGE_PRICING.trial
    }
  });

  await sequelize.query(`
    UPDATE subscription_plans 
    SET "storageLimitMB" = :limit, "storagePrice100GB" = :price
    WHERE "planId" = 'launch'
  `, {
    replacements: { 
      limit: DEFAULT_STORAGE_LIMITS.launch,
      price: STORAGE_PRICING.launch
    }
  });

  await sequelize.query(`
    UPDATE subscription_plans 
    SET "storageLimitMB" = :limit, "storagePrice100GB" = :price
    WHERE "planId" = 'scale'
  `, {
    replacements: { 
      limit: DEFAULT_STORAGE_LIMITS.scale,
      price: STORAGE_PRICING.scale
    }
  });

  await sequelize.query(`
    UPDATE subscription_plans 
    SET "storageLimitMB" = NULL, "storagePrice100GB" = NULL
    WHERE "planId" = 'enterprise'
  `);

  console.log('[Migration] Storage limit columns added and defaults set!');
  console.log('Storage Limits:');
  console.log('  Trial: 1 GB');
  console.log('  Launch: 10 GB (+GHS 15/100GB)');
  console.log('  Scale: 50 GB (+GHS 12/100GB)');
  console.log('  Enterprise: Unlimited');
}

async function down() {
  const queryInterface = sequelize.getQueryInterface();

  console.log('Removing storage limit columns...');
  await queryInterface.removeColumn('subscription_plans', 'storageLimitMB');
  await queryInterface.removeColumn('subscription_plans', 'storagePrice100GB');
  console.log('[Migration] Storage limit columns removed');
}

// Run migration if called directly
if (require.main === module) {
  up()
    .then(() => {
      console.log('Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { up, down };

