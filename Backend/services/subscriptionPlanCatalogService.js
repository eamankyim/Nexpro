/**
 * Canonical Paystack-backed subscription plan catalog.
 * Paystack is the source of truth for public Starter/Professional amounts and plan codes.
 */
const paystackService = require('./paystackService');
const { SubscriptionPlan } = require('../models');
const { plans: configPlans } = require('../config/plans');
const { getFeatureFlagsForPlan, getFeaturesForPlan } = require('../config/features');
const { ENTERPRISE_TIERS } = require('../config/enterpriseTiers');
const { setPlanCode, getPlanCode } = require('../config/paystackPlans');
const {
  CANONICAL_SELF_SERVICE,
  SELF_SERVICE_PLAN_IDS,
  LEGACY_IGNORE_AMOUNTS,
} = require('../config/canonicalPaystackPlans');

const normalizeName = (name) =>
  String(name || '')
    .trim()
    .replace(/\s+/g, ' ');

const billingPeriodFromInterval = (interval) =>
  interval === 'annually' || interval === 'yearly' ? 'yearly' : 'monthly';

const pesewasToGhs = (pesewas) => (pesewas == null ? null : pesewas / 100);

/**
 * Classify a Paystack plan row as canonical, ignored, or unknown.
 * @param {object} paystackPlan
 * @returns {{ kind: 'canonical'|'ignored'|'unknown', planId?: string, billingPeriod?: string, spec?: object, reason?: string }}
 */
function classifyPaystackPlan(paystackPlan) {
  const name = normalizeName(paystackPlan?.name);
  const amount = paystackPlan?.amount;
  const interval = paystackPlan?.interval;
  const currency = paystackPlan?.currency || 'GHS';

  if (!name || amount == null || !interval) {
    return { kind: 'unknown', reason: 'incomplete_row' };
  }
  if (currency !== 'GHS') {
    return { kind: 'ignored', reason: 'unsupported_currency' };
  }
  if (/enterprise/i.test(name)) {
    return { kind: 'ignored', reason: 'enterprise_manual_only' };
  }
  if (LEGACY_IGNORE_AMOUNTS.has(amount)) {
    return { kind: 'ignored', reason: 'legacy_duplicate_amount' };
  }

  for (const planId of SELF_SERVICE_PLAN_IDS) {
    for (const billingPeriod of ['monthly', 'yearly']) {
      const spec = CANONICAL_SELF_SERVICE[planId][billingPeriod];
      if (
        name.toLowerCase() === spec.name.toLowerCase() &&
        amount === spec.amount &&
        interval === spec.interval
      ) {
        return { kind: 'canonical', planId, billingPeriod, spec };
      }
    }
  }

  if (/starter|professional/i.test(name)) {
    return { kind: 'ignored', reason: 'name_amount_interval_mismatch' };
  }

  return { kind: 'unknown', reason: 'unrecognized_plan' };
}

/**
 * Pick best Paystack row per canonical slot when duplicates exist.
 * @param {object[]} paystackPlans
 */
function pickCanonicalPaystackPlans(paystackPlans = []) {
  const slots = new Map();
  const ignored = [];

  for (const row of paystackPlans) {
    const classification = classifyPaystackPlan(row);
    if (classification.kind !== 'canonical') {
      if (classification.kind === 'ignored') {
        ignored.push({
          plan_code: row.plan_code,
          name: row.name,
          amount: row.amount,
          interval: row.interval,
          reason: classification.reason,
        });
      }
      continue;
    }

    const key = `${classification.planId}:${classification.billingPeriod}`;
    const prev = slots.get(key);
    const rowActive =
      row.status !== 'inactive' &&
      row.status !== 'archived' &&
      row.active !== false &&
      row.isActive !== false;

    if (!prev) {
      slots.set(key, { row, classification });
      continue;
    }

    const prevActive =
      prev.row.status !== 'inactive' &&
      prev.row.status !== 'archived' &&
      prev.row.active !== false &&
      prev.row.isActive !== false;

    if (rowActive && !prevActive) {
      ignored.push({
        plan_code: prev.row.plan_code,
        name: prev.row.name,
        amount: prev.row.amount,
        interval: prev.row.interval,
        reason: 'duplicate_canonical_slot',
      });
      slots.set(key, { row, classification });
    } else if (rowActive === prevActive && (row.id || 0) > (prev.row.id || 0)) {
      ignored.push({
        plan_code: prev.row.plan_code,
        name: prev.row.name,
        amount: prev.row.amount,
        interval: prev.row.interval,
        reason: 'duplicate_canonical_slot',
      });
      slots.set(key, { row, classification });
    } else {
      ignored.push({
        plan_code: row.plan_code,
        name: row.name,
        amount: row.amount,
        interval: row.interval,
        reason: 'duplicate_canonical_slot',
      });
    }
  }

  return {
    canonical: Array.from(slots.values()),
    ignored,
  };
}

/**
 * @param {object} [options]
 * @param {object[]} [options.paystackPlans] - pre-fetched Paystack rows
 */
async function syncCanonicalPlansToDatabase(options = {}) {
  let paystackPlans = options.paystackPlans;
  if (!paystackPlans) {
    const res = await paystackService.listPlans();
    if (!res?.status || !Array.isArray(res.data)) {
      throw Object.assign(new Error('Failed to fetch plans from Paystack'), { statusCode: 502 });
    }
    paystackPlans = res.data;
  }

  const { canonical, ignored } = pickCanonicalPaystackPlans(paystackPlans);
  const variantsByPlanId = {};

  for (const { row, classification } of canonical) {
    const { planId, billingPeriod } = classification;
    if (!variantsByPlanId[planId]) variantsByPlanId[planId] = {};
    variantsByPlanId[planId][billingPeriod] = {
      planCode: row.plan_code,
      amountPesewas: row.amount,
      interval: row.interval,
      currency: row.currency || 'GHS',
      name: row.name,
      description: row.description || '',
      syncedAt: new Date().toISOString(),
    };
    setPlanCode(planId, billingPeriod, row.plan_code);
  }

  const synced = [];
  const errors = [];

  for (const planId of SELF_SERVICE_PLAN_IDS) {
    const variants = variantsByPlanId[planId];
    if (!variants || !variants.monthly) {
      errors.push({ planId, error: 'Missing canonical monthly variant from Paystack' });
      continue;
    }

    try {
      const configPlan = configPlans.find((p) => p.id === planId) || {};
      const monthlyGhs = pesewasToGhs(variants.monthly.amountPesewas);
      const yearlyGhs = variants.yearly ? pesewasToGhs(variants.yearly.amountPesewas) : null;

      const price = {
        amount: monthlyGhs,
        currency: 'GHS',
        display: `GHS ${monthlyGhs}/mo`,
        billingPeriodLabel: 'per month',
        billingDescription: yearlyGhs
          ? `GHS ${(yearlyGhs / 12).toFixed(0)} per month when billed annually`
          : `GHS ${monthlyGhs} per month`,
        paystackVariants: {
          monthly: {
            amount: monthlyGhs,
            amountPesewas: variants.monthly.amountPesewas,
            display: `GHS ${monthlyGhs}/mo`,
          },
          yearly: yearlyGhs
            ? {
                amount: yearlyGhs,
                amountPesewas: variants.yearly.amountPesewas,
                display: `GHS ${(yearlyGhs / 12).toFixed(0)}/mo`,
                billingDescription: `GHS ${yearlyGhs} billed annually`,
              }
            : null,
        },
      };

      const metadata = {
        paystackVariants: variants,
        featureFlags: getFeatureFlagsForPlan(planId),
        featureKeys: getFeaturesForPlan(planId),
        paystackSyncedAt: new Date().toISOString(),
      };

      const [row, created] = await SubscriptionPlan.findOrCreate({
        where: { planId },
        defaults: {
          planId,
          order: configPlan.order ?? 0,
          name: configPlan.name || planId,
          description: configPlan.description || '',
          price,
          highlights: configPlan.highlights || [],
          marketing: configPlan.marketing || { enabled: true },
          onboarding: configPlan.onboarding || {},
          isActive: true,
          metadata,
        },
      });

      if (!created) {
        const prevMeta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
        const marketing = {
          ...(configPlan.marketing || {}),
          ...(row.marketing || {}),
          featureFlags: getFeatureFlagsForPlan(planId),
        };
        await row.update({
          price,
          marketing,
          metadata: { ...prevMeta, ...metadata },
          name: row.name || configPlan.name,
          description: row.description || configPlan.description,
        });
      }

      synced.push({
        planId,
        variants: Object.keys(variants),
        action: created ? 'created' : 'updated',
      });
    } catch (err) {
      errors.push({ planId, error: err.message });
    }
  }

  return { synced, ignored, errors, paystackPlanCount: paystackPlans.length };
}

/**
 * Load self-service pricing from DB catalog (with env/fallback).
 * @param {string} plan - starter | professional
 * @param {string} billingPeriod - monthly | yearly
 */
async function resolvePaidPlanPricing(plan, billingPeriod) {
  const planId = String(plan || '').toLowerCase();
  const period = billingPeriod === 'yearly' ? 'yearly' : 'monthly';
  if (!SELF_SERVICE_PLAN_IDS.includes(planId)) {
    return null;
  }

  const spec = CANONICAL_SELF_SERVICE[planId][period];
  let amountPesewas = spec.amount;
  let planCode = getPlanCode(planId, period);

  try {
    const row = await SubscriptionPlan.findOne({ where: { planId, isActive: true } });
    const variant = row?.metadata?.paystackVariants?.[period];
    if (variant?.amountPesewas != null) {
      amountPesewas = variant.amountPesewas;
    }
    if (variant?.planCode) {
      planCode = variant.planCode;
      setPlanCode(planId, period, planCode);
    }
  } catch {
    // use fallback spec + env
  }

  return {
    planId,
    billingPeriod: period,
    amountPesewas,
    amountGhs: pesewasToGhs(amountPesewas),
    planCode,
    currency: 'GHS',
    displayName: spec.name,
    featureFlags: getFeatureFlagsForPlan(planId),
    featureKeys: getFeaturesForPlan(planId),
  };
}

/**
 * Expand starter/professional DB rows into marketing monthly/yearly cards.
 * @param {object[]} plans
 */
function expandPlansWithPaystackVariants(plans, mapFn) {
  const expanded = [];
  const paystackIds = SELF_SERVICE_PLAN_IDS;

  for (const plan of plans) {
    const id = (plan.id || plan.planId || '').toLowerCase();
    if (!paystackIds.includes(id)) {
      expanded.push(mapFn(plan));
      continue;
    }

    const variants = plan.price?.paystackVariants || plan.metadata?.paystackVariants;
    const monthly =
      variants?.monthly?.amount ??
      (variants?.monthly?.amountPesewas != null
        ? pesewasToGhs(variants.monthly.amountPesewas)
        : pesewasToGhs(CANONICAL_SELF_SERVICE[id].monthly.amount));
    const yearlyVariant = variants?.yearly;
    const yearly =
      yearlyVariant?.amount ??
      (yearlyVariant?.amountPesewas != null
        ? pesewasToGhs(yearlyVariant.amountPesewas)
        : pesewasToGhs(CANONICAL_SELF_SERVICE[id].yearly.amount));

    expanded.push(
      mapFn(plan, {
        interval: 'monthly',
        priceOverride: {
          amount: monthly,
          currency: 'GHS',
          display: `GHS ${monthly}/mo`,
          billingDescription: `GHS ${monthly} per month`,
        },
      })
    );
    expanded.push(
      mapFn(plan, {
        interval: 'annually',
        priceOverride: {
          amount: yearly,
          currency: 'GHS',
          display: `GHS ${(yearly / 12).toFixed(0)}/mo`,
          billingDescription: `GHS ${(yearly / 12).toFixed(0)} per month when billed annually`,
        },
      })
    );
  }
  return expanded;
}

/**
 * Enterprise tiers for public pricing (contact sales / manual billing only).
 */
function getEnterprisePublicPricing() {
  return {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'On-premise license with optional cloud renewal after year one.',
    contactSales: true,
    tiers: Object.values(ENTERPRISE_TIERS).map((tier) => ({
      id: tier.id,
      name: tier.name,
      licenseFeeGhs: tier.licenseFeeGhs,
      cloudPlanAnnualGhs: tier.cloudPlanAnnualGhs,
      seatLimit: tier.seatLimit,
      storageLimitMB: tier.storageLimitMB,
    })),
  };
}

const addYears = (date, years) => {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
};

/**
 * Build enterprise manual payment metadata.
 * @param {object} params
 * @param {string} params.enterpriseTier
 * @param {string} [params.paymentType] - enterprise_license | enterprise_cloud_renewal
 * @param {Date} [params.at]
 * @param {string} [params.existingCloudNextDueAt]
 */
function buildEnterprisePaymentMetadata(params) {
  const tier = ENTERPRISE_TIERS[String(params.enterpriseTier || '').toLowerCase()];
  if (!tier) {
    throw Object.assign(new Error('Invalid enterprise tier'), { statusCode: 400 });
  }

  const paymentType = params.paymentType || 'enterprise_license';
  const at = params.at ? new Date(params.at) : new Date();

  if (paymentType === 'enterprise_cloud_renewal') {
    const base = params.existingCloudNextDueAt
      ? new Date(params.existingCloudNextDueAt)
      : at;
    const cloudNextDueAt = addYears(base > at ? base : at, 1);
    return {
      paymentType,
      enterpriseTier: tier.id,
      licenseFeeGhs: null,
      cloudPlanAnnualGhs: tier.cloudPlanAnnualGhs,
      cloudRenewalStartsAt: params.existingCloudRenewalStartsAt || null,
      cloudNextDueAt: cloudNextDueAt.toISOString(),
      periodEnd: cloudNextDueAt.toISOString(),
      suggestedAmountGhs: tier.cloudPlanAnnualGhs,
    };
  }

  const cloudRenewalStartsAt = addYears(at, 1);
  const cloudNextDueAt = cloudRenewalStartsAt;
  return {
    paymentType: 'enterprise_license',
    enterpriseTier: tier.id,
    licenseFeeGhs: tier.licenseFeeGhs,
    cloudPlanAnnualGhs: tier.cloudPlanAnnualGhs,
    cloudRenewalStartsAt: cloudRenewalStartsAt.toISOString(),
    cloudNextDueAt: cloudNextDueAt.toISOString(),
    periodEnd: cloudRenewalStartsAt.toISOString(),
    suggestedAmountGhs: tier.licenseFeeGhs,
  };
}

module.exports = {
  CANONICAL_SELF_SERVICE,
  SELF_SERVICE_PLAN_IDS,
  classifyPaystackPlan,
  pickCanonicalPaystackPlans,
  syncCanonicalPlansToDatabase,
  resolvePaidPlanPricing,
  expandPlansWithPaystackVariants,
  getEnterprisePublicPricing,
  buildEnterprisePaymentMetadata,
  pesewasToGhs,
};
