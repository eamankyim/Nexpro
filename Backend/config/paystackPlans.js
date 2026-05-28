/**
 * Paystack plan mapping and canonical expectations.
 * Live amounts and plan codes come from Paystack via subscriptionPlanCatalogService.
 * Env overrides (PAYSTACK_PLAN_STARTER_MONTHLY=PLN_xxx) are fallback only.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { CANONICAL_SELF_SERVICE } = require('./canonicalPaystackPlans');

/** Build fallback PLAN_DEFINITIONS from canonical expected amounts (not price authority). */
const buildPlanDefinitions = () => {
  const defs = {
    enterprise: {
      contactSales: true,
      name: { monthly: 'Enterprise', yearly: 'Enterprise' },
      description: {
        monthly: 'Unlimited team members - Contact sales',
        yearly: 'Unlimited - Contact sales',
      },
    },
  };

  for (const [planId, periods] of Object.entries(CANONICAL_SELF_SERVICE)) {
    defs[planId] = {
      monthly: periods.monthly.amount,
      yearly: periods.yearly.amount,
      name: {
        monthly: periods.monthly.name,
        yearly: periods.yearly.name,
      },
      description: {
        monthly: periods.monthly.name,
        yearly: periods.yearly.name,
      },
    };
  }
  return defs;
};

const PLAN_DEFINITIONS = buildPlanDefinitions();

/** Paystack interval: our billingPeriod -> Paystack interval */
const INTERVAL_MAP = {
  monthly: 'monthly',
  yearly: 'annually',
};

const planCodeCache = {};

/**
 * Get Paystack plan code for internal plan + billing period (env fallback, then cache).
 * @param {string} plan
 * @param {string} billingPeriod
 * @returns {string|null}
 */
function getPlanCode(plan, billingPeriod) {
  const envKey = `PAYSTACK_PLAN_${plan.toUpperCase()}_${billingPeriod.toUpperCase()}`;
  const fromCache = planCodeCache[plan]?.[billingPeriod];
  if (fromCache) return fromCache;
  const fromEnv = process.env[envKey];
  if (fromEnv) return fromEnv;
  return null;
}

function setPlanCode(plan, billingPeriod, code) {
  if (!planCodeCache[plan]) planCodeCache[plan] = {};
  planCodeCache[plan][billingPeriod] = code;
}

/**
 * Fallback plan definition for Paystack plan creation scripts.
 */
function getPlanDefinition(plan, billingPeriod) {
  const def = PLAN_DEFINITIONS[plan];
  if (!def || def.contactSales) return null;
  const amount = def[billingPeriod === 'yearly' ? 'yearly' : 'monthly'];
  const interval = INTERVAL_MAP[billingPeriod] || 'monthly';
  const name = def.name?.[billingPeriod] || `${plan} (${billingPeriod})`;
  const description = def.description?.[billingPeriod] || '';
  return { name, amount, interval, description };
}

function getFallbackAmountPesewas(plan, billingPeriod) {
  const def = PLAN_DEFINITIONS[plan];
  if (!def || def.contactSales) return null;
  return billingPeriod === 'yearly' ? def.yearly : def.monthly;
}

function isContactSalesPlan(plan) {
  return PLAN_DEFINITIONS[plan]?.contactSales === true;
}

module.exports = {
  PLAN_DEFINITIONS,
  CANONICAL_SELF_SERVICE,
  INTERVAL_MAP,
  getPlanCode,
  setPlanCode,
  getPlanDefinition,
  getFallbackAmountPesewas,
  isContactSalesPlan,
  planCodeCache,
};
