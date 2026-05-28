/**
 * Expected canonical Paystack self-service plans (amounts in pesewas).
 * Paystack dashboard must match these name + amount + interval rows.
 */
const CANONICAL_SELF_SERVICE = {
  starter: {
    monthly: {
      name: 'Starter (Monthly)',
      amount: 12900,
      interval: 'monthly',
    },
    yearly: {
      name: 'Starter (Yearly)',
      amount: 118800,
      interval: 'annually',
    },
  },
  professional: {
    monthly: {
      name: 'Professional (Monthly)',
      amount: 25000,
      interval: 'monthly',
    },
    yearly: {
      name: 'Professional (Yearly)',
      amount: 238800,
      interval: 'annually',
    },
  },
};

const SELF_SERVICE_PLAN_IDS = Object.keys(CANONICAL_SELF_SERVICE);
const LEGACY_IGNORE_AMOUNTS = new Set([19900, 191000]);

module.exports = {
  CANONICAL_SELF_SERVICE,
  SELF_SERVICE_PLAN_IDS,
  LEGACY_IGNORE_AMOUNTS,
};
