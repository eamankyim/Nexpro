const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');
const { plans } = require('../config/plans');

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

