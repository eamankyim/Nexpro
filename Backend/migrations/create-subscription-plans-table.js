const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');
const { plans } = require('../config/plans');
const {
  DEFAULT_PLAN_SEAT_LIMITS,
  DEFAULT_PLAN_BRANCH_LIMITS,
  PLAN_SEAT_PRICING,
  DEFAULT_STORAGE_LIMITS,
  STORAGE_PRICING,
} = require('../config/features');

/**
 * Migration: Create subscription_plans table and seed with data from config/plans.js
 */

async function addIndexIfMissing(queryInterface, tableName, fields, options) {
  try {
    await queryInterface.addIndex(tableName, fields, options);
  } catch (error) {
    const message = String(error?.message || error);
    if (message.includes('already exists') || error?.name === 'SequelizeDatabaseError') {
      console.log(`ℹ️  Index ${options?.name || fields.join('_')} already exists`);
      return;
    }
    throw error;
  }
}

async function addColumnIfMissing(queryInterface, tableName, columnName, definition) {
  const table = await queryInterface.describeTable(tableName);
  if (table[columnName]) return;
  await queryInterface.addColumn(tableName, columnName, definition);
}

async function up() {
  const queryInterface = sequelize.getQueryInterface();
  const tables = await queryInterface.showAllTables();
  const tableExists = tables.includes('subscription_plans');

  if (tableExists) {
    console.log('ℹ️  subscription_plans table already exists');
  } else {
    console.log('Creating subscription_plans table...');
  }

  if (!tableExists) await queryInterface.createTable('subscription_plans', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    planId: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true
    },
    order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    price: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {}
    },
    highlights: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: []
    },
    marketing: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {}
    },
    onboarding: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {}
    },
    seatLimit: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    seatPricePerAdditional: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    branchLimit: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    storageLimitMB: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    storagePrice100GB: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  });

  await addColumnIfMissing(queryInterface, 'subscription_plans', 'seatLimit', {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Maximum number of users/seats allowed (null = unlimited)'
  });
  await addColumnIfMissing(queryInterface, 'subscription_plans', 'seatPricePerAdditional', {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: 'Price per additional seat beyond base limit'
  });
  await addColumnIfMissing(queryInterface, 'subscription_plans', 'branchLimit', {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Maximum number of branches/locations/shops allowed (null = unlimited)'
  });
  await addColumnIfMissing(queryInterface, 'subscription_plans', 'storageLimitMB', {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Maximum storage in megabytes (null = unlimited)'
  });
  await addColumnIfMissing(queryInterface, 'subscription_plans', 'storagePrice100GB', {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: 'Price per additional 100GB of storage'
  });

  console.log('Creating indexes...');

  await addIndexIfMissing(queryInterface, 'subscription_plans', ['planId'], {
    unique: true,
    name: 'subscription_plans_planId_unique',
  });

  await addIndexIfMissing(queryInterface, 'subscription_plans', ['order'], {
    name: 'subscription_plans_order_idx',
  });

  await addIndexIfMissing(queryInterface, 'subscription_plans', ['isActive'], {
    name: 'subscription_plans_isActive_idx',
  });

  console.log('Seeding subscription_plans with data from config/plans.js...');

  await sequelize.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

  const { SubscriptionPlan } = require('../models');

  let created = 0;
  let updated = 0;
  for (const plan of plans) {
    const payload = {
      order: plan.order || 0,
      name: plan.name,
      description: plan.description,
      price: plan.price,
      highlights: plan.highlights || [],
      marketing: plan.marketing || {},
      onboarding: plan.onboarding || {},
      seatLimit: DEFAULT_PLAN_SEAT_LIMITS[plan.id] ?? null,
      seatPricePerAdditional: PLAN_SEAT_PRICING[plan.id] ?? null,
      branchLimit: DEFAULT_PLAN_BRANCH_LIMITS[plan.id] ?? null,
      storageLimitMB: DEFAULT_STORAGE_LIMITS[plan.id] ?? null,
      storagePrice100GB: STORAGE_PRICING[plan.id] ?? null,
      isActive: true,
      metadata: {},
    };
    const [row, wasCreated] = await SubscriptionPlan.findOrCreate({
      where: { planId: plan.id },
      defaults: { planId: plan.id, ...payload },
    });
    if (wasCreated) {
      created += 1;
    } else {
      await row.update(payload);
      updated += 1;
    }
  }

  console.log(
    `[Migration] Subscription plans ready (${created} created, ${updated} updated, ${plans.length} total in config)`
  );
}

async function down() {
  const queryInterface = sequelize.getQueryInterface();

  console.log('Dropping subscription_plans table...');
  await queryInterface.dropTable('subscription_plans');
  console.log('[Migration] Dropped subscription_plans table');
}

// Run migration if called directly
if (require.main === module) {
  (async () => {
    try {
      await up();
      console.log('Migration completed successfully!');
      process.exit(0);
    } catch (error) {
      console.error('Migration failed:', error);
      process.exit(1);
    }
  })();
}

module.exports = { up, down };

