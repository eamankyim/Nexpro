#!/usr/bin/env node
/**
 * Report tenants that would be locked by billing enforcement (no mutations).
 * Run: node scripts/enforce-subscription-billing.js
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize, testConnection } = require('../config/database');
const { Tenant } = require('../models');
const { resolveBillingStatus } = require('../services/subscriptionBillingService');

async function main() {
  await testConnection();
  const tenants = await Tenant.scope('withOptionalColumns').findAll({
    attributes: ['id', 'name', 'plan', 'status', 'trialEndsAt', 'metadata'],
    order: [['name', 'ASC']],
  });

  const locked = [];
  const grace = [];
  for (const tenant of tenants) {
    const billing = await resolveBillingStatus(tenant);
    if (billing.billingStatus === 'locked') {
      locked.push({ id: tenant.id, name: tenant.name, plan: tenant.plan, lockReason: billing.lockReason });
    } else if (billing.billingStatus === 'grace') {
      grace.push({ id: tenant.id, name: tenant.name, plan: tenant.plan, daysRemaining: billing.daysRemaining });
    }
  }

  console.log(`Tenants checked: ${tenants.length}`);
  console.log(`Grace period: ${grace.length}`);
  console.log(`Would be locked: ${locked.length}`);
  if (grace.length) {
    console.log('\nGrace:');
    grace.forEach((t) => console.log(`  - ${t.name} (${t.id}) — ${t.daysRemaining}d left`));
  }
  if (locked.length) {
    console.log('\nLocked:');
    locked.forEach((t) => console.log(`  - ${t.name} (${t.id}) — ${t.lockReason}`));
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => sequelize.close().catch(() => {}));
