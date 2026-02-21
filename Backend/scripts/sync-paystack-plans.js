#!/usr/bin/env node
/**
 * Sync Paystack plans - creates plans in Paystack and outputs plan codes
 * Run: node scripts/sync-paystack-plans.js
 *
 * Plan codes can be set in .env:
 * PAYSTACK_PLAN_STARTER_MONTHLY=PLN_xxx
 * PAYSTACK_PLAN_STARTER_YEARLY=PLN_xxx
 * etc.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const paystackService = require('../services/paystackService');
const { getPlanCode, setPlanCode, getPlanDefinition } = require('../config/paystackPlans');

const PLANS = ['starter', 'professional'];
const PERIODS = ['monthly', 'yearly'];

async function findExistingPlan(name, amount, interval) {
  const res = await paystackService.listPlans();
  if (!res.status || !res.data) return null;
  const match = res.data.find(
    (p) => p.name === name && p.amount === amount && p.interval === interval && p.currency === 'GHS'
  );
  return match ? match.plan_code : null;
}

async function ensurePlan(plan, billingPeriod) {
  const def = getPlanDefinition(plan, billingPeriod);
  if (!def) {
    console.error(`  ❌ No definition for ${plan}/${billingPeriod}`);
    return null;
  }

  const existing = await findExistingPlan(def.name, def.amount, def.interval);
  if (existing) {
    console.log(`  ✓ ${plan} ${billingPeriod}: ${existing} (already exists)`);
    setPlanCode(plan, billingPeriod, existing);
    return existing;
  }

  const result = await paystackService.createPlan({
    name: def.name,
    amount: def.amount,
    interval: def.interval,
    description: def.description,
    currency: 'GHS'
  });

  if (result.status && result.data?.plan_code) {
    const code = result.data.plan_code;
    console.log(`  ✓ ${plan} ${billingPeriod}: ${code} (created)`);
    setPlanCode(plan, billingPeriod, code);
    return code;
  }
  console.error(`  ❌ Failed to create ${plan} ${billingPeriod}:`, result.message);
  return null;
}

async function main() {
  if (!paystackService.secretKey) {
    console.error('❌ PAYSTACK_SECRET_KEY not set. Add it to .env');
    process.exit(1);
  }

  console.log('Syncing Paystack plans...\n');

  const codes = {};
  for (const plan of PLANS) {
    for (const period of PERIODS) {
      const code = await ensurePlan(plan, period);
      if (code) {
        if (!codes[plan]) codes[plan] = {};
        codes[plan][period] = code;
      }
    }
  }

  console.log('\n--- Add these to your .env ---\n');
  for (const plan of PLANS) {
    for (const period of PERIODS) {
      const code = getPlanCode(plan, period) || codes[plan]?.[period];
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
