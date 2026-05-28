const { Op } = require('sequelize');
const { Tenant, Setting, SubscriptionPayment } = require('../models');
const { normalizeTenantInstanceForRequest } = require('../utils/tenantClassification');
const { PLAN_DEFINITIONS } = require('../config/paystackPlans');

const PAID_PLANS = new Set(['starter', 'professional', 'enterprise']);
const DEFAULT_GRACE_DAYS = Number(process.env.SUBSCRIPTION_GRACE_DAYS || 7);

const normalizePlan = (plan = '') => String(plan || '').trim().toLowerCase();
const normalizeBillingPeriod = (value = '') =>
  String(value).trim().toLowerCase() === 'yearly' ? 'yearly' : 'monthly';

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const addPeriod = (fromDate, billingPeriod) => {
  const dt = new Date(fromDate);
  if (billingPeriod === 'yearly') dt.setFullYear(dt.getFullYear() + 1);
  else dt.setMonth(dt.getMonth() + 1);
  return dt;
};

const daysBetween = (from, to) => {
  const ms = startOfDay(to).getTime() - startOfDay(from).getTime();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
};

/**
 * @param {string} tenantId
 */
async function getSubscriptionSetting(tenantId) {
  const row = await Setting.findOne({ where: { tenantId, key: 'subscription' } });
  return row?.value || {};
}

/**
 * Latest successful payment that covers `at` (default now).
 * @param {string} tenantId
 * @param {Date} [at]
 */
async function getActivePaymentForTenant(tenantId, at = new Date()) {
  return SubscriptionPayment.findOne({
    where: {
      tenantId,
      status: 'success',
      periodStart: { [Op.lte]: at },
      periodEnd: { [Op.gt]: at },
    },
    order: [['periodEnd', 'DESC']],
  });
}

/**
 * @param {import('../models').Tenant|string} tenantOrId
 * @param {{ at?: Date, subscriptionSetting?: object }} [options]
 */
async function resolveBillingStatus(tenantOrId, options = {}) {
  const at = options.at || new Date();
  let tenant =
    typeof tenantOrId === 'string'
      ? await Tenant.scope('withOptionalColumns').findByPk(tenantOrId)
      : tenantOrId;
  if (!tenant) {
    return {
      billingStatus: 'unknown',
      lockReason: 'tenant_not_found',
      canAccessApp: false,
      trialEndsAt: null,
      currentPeriodEnd: null,
      graceEndsAt: null,
      daysRemaining: 0,
      plan: 'trial',
      activePayment: null,
    };
  }

  tenant = normalizeTenantInstanceForRequest(tenant);
  const subscription = options.subscriptionSetting || (await getSubscriptionSetting(tenant.id));
  const entitlements = tenant.metadata?.entitlements || {};
  const accessState = entitlements.accessState || (tenant.status === 'paused' ? 'restricted' : 'active');

  if (accessState === 'suspended' || tenant.status === 'suspended') {
    return {
      billingStatus: 'suspended',
      lockReason: 'platform_suspended',
      canAccessApp: false,
      trialEndsAt: tenant.trialEndsAt || subscription.trialEndsAt || null,
      currentPeriodEnd: subscription.currentPeriodEnd || null,
      graceEndsAt: null,
      daysRemaining: 0,
      plan: normalizePlan(tenant.plan) || 'trial',
      activePayment: null,
    };
  }

  if (entitlements.billingOverride === 'unlocked') {
    return {
      billingStatus: 'manual_override',
      lockReason: null,
      canAccessApp: true,
      trialEndsAt: tenant.trialEndsAt || subscription.trialEndsAt || null,
      currentPeriodEnd: subscription.currentPeriodEnd || null,
      graceEndsAt: null,
      daysRemaining: null,
      plan: normalizePlan(tenant.plan) || 'trial',
      activePayment: null,
    };
  }

  const activePayment = await getActivePaymentForTenant(tenant.id, at);
  const trialEndsAt = tenant.trialEndsAt
    ? new Date(tenant.trialEndsAt)
    : subscription.trialEndsAt
      ? new Date(subscription.trialEndsAt)
      : null;
  const plan = normalizePlan(tenant.plan) || normalizePlan(subscription.plan) || 'trial';
  const currentPeriodEnd = activePayment
    ? new Date(activePayment.periodEnd)
    : subscription.currentPeriodEnd
      ? new Date(subscription.currentPeriodEnd)
      : null;

  if (activePayment && PAID_PLANS.has(normalizePlan(activePayment.plan))) {
    const daysRemaining = daysBetween(at, activePayment.periodEnd);
    return {
      billingStatus: 'active',
      lockReason: null,
      canAccessApp: true,
      trialEndsAt,
      currentPeriodEnd,
      graceEndsAt: null,
      daysRemaining: Math.max(0, daysRemaining),
      plan: normalizePlan(activePayment.plan),
      activePayment,
    };
  }

  const isTrialPlan = plan === 'trial' || !PAID_PLANS.has(plan);
  if (isTrialPlan && trialEndsAt && at < trialEndsAt) {
    return {
      billingStatus: 'trialing',
      lockReason: null,
      canAccessApp: true,
      trialEndsAt,
      currentPeriodEnd: null,
      graceEndsAt: null,
      daysRemaining: daysBetween(at, trialEndsAt),
      plan: 'trial',
      activePayment: null,
    };
  }

  const graceDays =
    Number(entitlements.billingGraceDays) > 0
      ? Number(entitlements.billingGraceDays)
      : DEFAULT_GRACE_DAYS;
  const periodEndForGrace = trialEndsAt || currentPeriodEnd;
  const graceEndsAt = periodEndForGrace ? addDays(periodEndForGrace, graceDays) : addDays(at, graceDays);

  if (periodEndForGrace && at < graceEndsAt) {
    return {
      billingStatus: 'grace',
      lockReason: trialEndsAt && at >= trialEndsAt ? 'trial_expired' : 'subscription_expired',
      canAccessApp: true,
      trialEndsAt,
      currentPeriodEnd,
      graceEndsAt,
      daysRemaining: daysBetween(at, graceEndsAt),
      plan,
      activePayment: null,
    };
  }

  return {
    billingStatus: 'locked',
    lockReason: trialEndsAt && at >= trialEndsAt ? 'trial_expired' : 'payment_required',
    canAccessApp: false,
    trialEndsAt,
    currentPeriodEnd,
    graceEndsAt,
    daysRemaining: 0,
    plan,
    activePayment: null,
  };
}

/**
 * Record payment and activate tenant (idempotent on providerReference).
 * @param {object} params
 * @param {string} params.tenantId
 * @param {string} params.plan
 * @param {string} params.billingPeriod
 * @param {number} params.amount
 * @param {string} [params.currency]
 * @param {string} params.provider
 * @param {string} [params.providerReference]
 * @param {string} [params.recordedBy]
 * @param {string} [params.notes]
 * @param {Date} [params.periodStart]
 * @param {Date} [params.periodEnd]
 * @param {object} [params.metadata]
 */
async function recordSubscriptionPaymentAndActivate(params) {
  const tenantId = params.tenantId;
  const plan = normalizePlan(params.plan);
  const billingPeriod = normalizeBillingPeriod(params.billingPeriod);
  const provider = params.provider || 'manual';
  const providerReference = params.providerReference || null;

  if (!tenantId || !PAID_PLANS.has(plan)) {
    throw Object.assign(new Error('Invalid tenant or plan for subscription payment'), { statusCode: 400 });
  }

  if (providerReference) {
    const existing = await SubscriptionPayment.findOne({
      where: { provider, providerReference, status: 'success' },
    });
    if (existing) {
      return { payment: existing, alreadyRecorded: true };
    }
  }

  const periodStart = params.periodStart ? new Date(params.periodStart) : new Date();
  const periodEnd = params.periodEnd ? new Date(params.periodEnd) : addPeriod(periodStart, billingPeriod);
  const amount =
    params.amount != null
      ? Number(params.amount)
      : PLAN_DEFINITIONS[plan]?.[billingPeriod === 'yearly' ? 'yearly' : 'monthly'] || 0;

  const payment = await SubscriptionPayment.create({
    tenantId,
    plan,
    billingPeriod,
    periodStart,
    periodEnd,
    amount,
    currency: params.currency || 'GHS',
    status: 'success',
    provider,
    providerReference,
    recordedBy: params.recordedBy || null,
    notes: params.notes || null,
    metadata: params.metadata || {},
  });

  await syncTenantSubscriptionState(tenantId, {
    plan,
    billingPeriod,
    currentPeriodEnd: periodEnd,
    lastPaymentReference: providerReference,
    payment,
  });

  return { payment, alreadyRecorded: false };
}

/**
 * @param {string} tenantId
 * @param {object} patch
 */
async function syncTenantSubscriptionState(tenantId, patch) {
  const [setting] = await Setting.findOrCreate({
    where: { tenantId, key: 'subscription' },
    defaults: {
      tenantId,
      key: 'subscription',
      value: {},
      description: 'Subscription and billing information',
    },
  });

  const prev = setting.value || {};
  const history = Array.isArray(prev.history) ? prev.history : [];
  if (patch.payment) {
    history.unshift({
      at: new Date().toISOString(),
      event: 'payment_recorded',
      reference: patch.payment.providerReference,
      amount: patch.payment.amount,
      plan: patch.payment.plan,
      billingPeriod: patch.payment.billingPeriod,
      provider: patch.payment.provider,
    });
  }

  const nextValue = {
    ...prev,
    plan: patch.plan || prev.plan,
    status: 'active',
    billingPeriod: patch.billingPeriod || prev.billingPeriod,
    currentPeriodEnd: (patch.currentPeriodEnd || new Date()).toISOString(),
    lastPaymentReference: patch.lastPaymentReference || prev.lastPaymentReference,
    history: history.slice(0, 100),
  };

  await setting.update({ value: nextValue });

  const tenant = await Tenant.scope('withOptionalColumns').findByPk(tenantId);
  if (tenant) {
    const metadata = { ...(tenant.metadata || {}) };
    const entitlements = { ...(metadata.entitlements || {}) };
    entitlements.accessState = 'active';
    metadata.entitlements = entitlements;
    await tenant.update({
      plan: patch.plan || tenant.plan,
      status: tenant.status === 'suspended' ? tenant.status : 'active',
      metadata,
    });
  }
}

/**
 * Paystack verify payload → payment record
 * @param {object} paymentData - Paystack transaction data
 * @param {string} source
 */
async function applySubscriptionFromPaystackTransaction(paymentData, source = 'verify') {
  const metadata =
    typeof paymentData?.metadata === 'string'
      ? JSON.parse(paymentData.metadata || '{}')
      : paymentData?.metadata || {};
  const tenantId = metadata.tenantId || metadata.tenant_id;
  const plan = normalizePlan(metadata.plan);
  const billingPeriod = normalizeBillingPeriod(metadata.billingPeriod || metadata.billing_period);
  const reference = paymentData?.reference;

  if (!tenantId || !plan || metadata.type !== 'subscription') {
    return null;
  }

  return recordSubscriptionPaymentAndActivate({
    tenantId,
    plan,
    billingPeriod,
    amount: paymentData?.amount,
    provider: 'paystack',
    providerReference: reference,
    metadata: { source, channel: paymentData?.channel || null },
  });
}

/**
 * JSON-safe billing payload for API responses.
 * @param {Awaited<ReturnType<typeof resolveBillingStatus>>} billing
 */
function toBillingPayload(billing) {
  if (!billing) return null;
  const ap = billing.activePayment;
  return {
    billingStatus: billing.billingStatus,
    lockReason: billing.lockReason,
    canAccessApp: billing.canAccessApp,
    trialEndsAt: billing.trialEndsAt,
    currentPeriodEnd: billing.currentPeriodEnd,
    graceEndsAt: billing.graceEndsAt,
    daysRemaining: billing.daysRemaining,
    plan: billing.plan,
    activePayment: ap
      ? {
          id: ap.id,
          plan: ap.plan,
          billingPeriod: ap.billingPeriod,
          periodStart: ap.periodStart,
          periodEnd: ap.periodEnd,
          amount: ap.amount,
          currency: ap.currency,
          provider: ap.provider,
          providerReference: ap.providerReference,
        }
      : null,
  };
}

module.exports = {
  PAID_PLANS,
  DEFAULT_GRACE_DAYS,
  normalizePlan,
  normalizeBillingPeriod,
  addPeriod,
  getSubscriptionSetting,
  getActivePaymentForTenant,
  resolveBillingStatus,
  recordSubscriptionPaymentAndActivate,
  syncTenantSubscriptionState,
  applySubscriptionFromPaystackTransaction,
  toBillingPayload,
};
