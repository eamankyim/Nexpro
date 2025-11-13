const { sequelize } = require('../config/database');
const { plans } = require('../config/plans');
const { SubscriptionPlan } = require('../models');

/**
 * Seed subscription plans from config/plans.js
 */

async function seed() {
  try {
    // Enable uuid extension
    await sequelize.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

    console.log('Seeding subscription plans...');

    // Check if plans already exist
    const existingCount = await SubscriptionPlan.count();
    if (existingCount > 0) {
      console.log(`[Seed] Found ${existingCount} existing plans. Skipping seed to avoid duplicates.`);
      console.log('To reseed, delete existing plans first.');
      return;
    }

    // Seed plans
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
      console.log(`  [Seed] Seeded: ${plan.name}`);
    }

    console.log(`\n[Seed] Successfully seeded ${plans.length} subscription plans!`);
  } catch (error) {
    console.error('[Seed] Seeding failed:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { seed };

