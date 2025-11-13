const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');
const { plans } = require('../config/plans');

/**
 * Migration: Create subscription_plans table and seed with data from config/plans.js
 */

async function up() {
  const queryInterface = sequelize.getQueryInterface();

  console.log('Creating subscription_plans table...');

  await queryInterface.createTable('subscription_plans', {
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

  await queryInterface.addIndex('subscription_plans', ['planId'], {
    unique: true,
    name: 'subscription_plans_planId_unique'
  });

  await queryInterface.addIndex('subscription_plans', ['order'], {
    name: 'subscription_plans_order_idx'
  });

  await queryInterface.addIndex('subscription_plans', ['isActive'], {
    name: 'subscription_plans_isActive_idx'
  });

  console.log('Seeding subscription_plans with data from config/plans.js...');

  // Enable uuid extension first
  await sequelize.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

  // Seed with existing plans from config using Sequelize model
  const { SubscriptionPlan } = require('../models');
  
  for (const plan of plans) {
    await SubscriptionPlan.create({
      planId: plan.id,
      order: plan.order || 0,
      name: plan.name,
      description: plan.description,
      price: plan.price,
      highlights: plan.highlights || [],
      marketing: plan.marketing || {},
      onboarding: plan.onboarding || {},
      isActive: true,
      metadata: {}
    });
  }

  console.log(`[Migration] Seeded ${plans.length} subscription plans successfully!`);
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

