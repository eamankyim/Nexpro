/**
 * Paystack plan definitions and code mapping
 * Plan codes are created via sync-paystack-plans.js and can be overridden via env
 *
 * Env override format: PAYSTACK_PLAN_STARTER_MONTHLY=PLN_xxx
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

/** Plan definitions: internal id -> { monthly: pesewas, yearly: pesewas } */
const PLAN_DEFINITIONS = {
  starter: {
    monthly: 12900,   // GHS 129
    yearly: 118800,   // GHS 1,188 (99 × 12, discounted rate)
    name: { monthly: 'Starter (Monthly)', yearly: 'Starter (Yearly)' },
    description: { monthly: 'Up to 5 team members', yearly: 'Up to 5 team members (GHS 99/mo)' }
  },
  professional: {
    monthly: 25000,   // GHS 250
    yearly: 238800,   // GHS 2,388 (199 × 12, discounted rate)
    name: { monthly: 'Professional (Monthly)', yearly: 'Professional (Yearly)' },
    description: { monthly: 'Up to 20 team members', yearly: 'Up to 20 team members (GHS 199/mo)' }
  },
  enterprise: {
    contactSales: true,
    name: { monthly: 'Enterprise', yearly: 'Enterprise' },
    description: { monthly: 'Unlimited team members - Contact sales', yearly: 'Unlimited - Contact sales' }
  }
};

/** Paystack interval: our billingPeriod -> Paystack interval */
const INTERVAL_MAP = {
  monthly: 'monthly',
  yearly: 'annually'
};

/**
 * Get Paystack plan code for internal plan + billing period
 * Checks env first (PAYSTACK_PLAN_STARTER_MONTHLY), then in-memory cache from sync
 * @param {string} plan - starter | professional | enterprise
 * @param {string} billingPeriod - monthly | yearly
 * @returns {string|null} Paystack plan code (PLN_xxx) or null
 */
function getPlanCode(plan, billingPeriod) {
  const envKey = `PAYSTACK_PLAN_${plan.toUpperCase()}_${billingPeriod.toUpperCase()}`;
  const fromEnv = process.env[envKey];
  if (fromEnv) return fromEnv;
  return planCodeCache[plan]?.[billingPeriod] || null;
}

/**
 * In-memory cache of plan codes (populated by sync script or at runtime)
 * Format: { starter: { monthly: 'PLN_xxx', yearly: 'PLN_yyy' }, ... }
 */
const planCodeCache = {};

/**
 * Set plan code in cache (used by sync script or after creating plan via API)
 */
function setPlanCode(plan, billingPeriod, code) {
  if (!planCodeCache[plan]) planCodeCache[plan] = {};
  planCodeCache[plan][billingPeriod] = code;
}

/**
 * Get plan definition for creating in Paystack
 * Returns null for contact-sales plans (e.g. enterprise)
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

/**
 * Check if plan requires contact sales (no Paystack payment)
 */
function isContactSalesPlan(plan) {
  return PLAN_DEFINITIONS[plan]?.contactSales === true;
}

module.exports = {
  PLAN_DEFINITIONS,
  INTERVAL_MAP,
  getPlanCode,
  setPlanCode,
  getPlanDefinition,
  isContactSalesPlan,
  planCodeCache
};
