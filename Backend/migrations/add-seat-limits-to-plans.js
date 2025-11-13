const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');
const { DEFAULT_PLAN_SEAT_LIMITS, PLAN_SEAT_PRICING } = require('../config/features');

/**
 * Add seat limit and pricing columns to subscription_plans
 */

async function up() {
  const queryInterface = sequelize.getQueryInterface();

  console.log('Adding seat limit columns to subscription_plans...');

  // Add seatLimit column
  await queryInterface.addColumn('subscription_plans', 'seatLimit', {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Maximum number of users/seats allowed (null = unlimited)'
  });

  // Add seatPricePerAdditional column
  await queryInterface.addColumn('subscription_plans', 'seatPricePerAdditional', {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: 'Price per additional seat beyond base limit'
  });

  console.log('Updating existing plans with default seat limits...');

  // Update existing plans with seat limits from config
  await sequelize.query(`
    UPDATE subscription_plans 
    SET "seatLimit" = :trialLimit, "seatPricePerAdditional" = :trialPrice
    WHERE "planId" = 'trial'
  `, {
    replacements: { 
      trialLimit: DEFAULT_PLAN_SEAT_LIMITS.trial,
      trialPrice: PLAN_SEAT_PRICING.trial
    }
  });

  await sequelize.query(`
    UPDATE subscription_plans 
    SET "seatLimit" = :launchLimit, "seatPricePerAdditional" = :launchPrice
    WHERE "planId" = 'launch'
  `, {
    replacements: { 
      launchLimit: DEFAULT_PLAN_SEAT_LIMITS.launch,
      launchPrice: PLAN_SEAT_PRICING.launch
    }
  });

  await sequelize.query(`
    UPDATE subscription_plans 
    SET "seatLimit" = :scaleLimit, "seatPricePerAdditional" = :scalePrice
    WHERE "planId" = 'scale'
  `, {
    replacements: { 
      scaleLimit: DEFAULT_PLAN_SEAT_LIMITS.scale,
      scalePrice: PLAN_SEAT_PRICING.scale
    }
  });

  await sequelize.query(`
    UPDATE subscription_plans 
    SET "seatLimit" = NULL, "seatPricePerAdditional" = NULL
    WHERE "planId" = 'enterprise'
  `);

  console.log('[Migration] Seat limit columns added and defaults set!');
}

async function down() {
  const queryInterface = sequelize.getQueryInterface();

  console.log('Removing seat limit columns...');
  await queryInterface.removeColumn('subscription_plans', 'seatLimit');
  await queryInterface.removeColumn('subscription_plans', 'seatPricePerAdditional');
  console.log('[Migration] Seat limit columns removed');
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

