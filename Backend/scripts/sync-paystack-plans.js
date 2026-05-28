#!/usr/bin/env node
/**
 * Sync canonical public Paystack plans (Starter/Professional monthly+yearly) into subscription_plans.
 * Run: node scripts/sync-paystack-plans.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const paystackService = require('../services/paystackService');
const { syncCanonicalPlansToDatabase } = require('../services/subscriptionPlanCatalogService');
const { getPlanCode } = require('../config/paystackPlans');

async function main() {
  if (!paystackService.secretKey) {
    console.error('❌ PAYSTACK_SECRET_KEY not set. Add it to .env');
    process.exit(1);
  }

  console.log('Syncing canonical Paystack plans...\n');
  const result = await syncCanonicalPlansToDatabase();

  console.log(`Paystack rows scanned: ${result.paystackPlanCount}`);
  console.log(`Synced app plans: ${result.synced.length}`);
  if (result.ignored.length) {
    console.log(`\nIgnored ${result.ignored.length} non-canonical/legacy rows:`);
    result.ignored.forEach((row) => {
      console.log(`  - ${row.name} (${row.plan_code}): ${row.reason}`);
    });
  }
  if (result.errors.length) {
    console.log('\nErrors:');
    result.errors.forEach((e) => console.log(`  - ${e.planId || e.paystackCode}: ${e.error}`));
  }

  console.log('\n--- Optional .env plan code overrides ---\n');
  for (const plan of ['starter', 'professional']) {
    for (const period of ['monthly', 'yearly']) {
      const code = getPlanCode(plan, period);
      if (code) {
        console.log(`PAYSTACK_PLAN_${plan.toUpperCase()}_${period.toUpperCase()}=${code}`);
      }
    }
  }
  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
