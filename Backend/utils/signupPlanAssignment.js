const dayjs = require('dayjs');
const { DEFAULT_TRIAL_MONTHS } = require('./subscriptionDefaults');

/**
 * Signup-channel plan assignment
 * --------------------------------
 * Mobile signup → `free_plan` (admin-created Free tier; NOT planId `free`, which aliases to trial).
 * Web / default signup → existing 1-month `trial`.
 *
 * Cross-app login does not reassign plans: channel is only evaluated at tenant creation.
 *
 * Free access window: 12 months stored on `tenant.trialEndsAt` (and subscription.trialEndsAt)
 * plus `metadata.accessEndsAt` for clarity. Billing treats `free_plan` as complimentary
 * until that date — not as a product trial remapped to plan "trial" (see subscriptionBillingService).
 * Prefer this over billingOverride:unlocked so access still ends after the year (grace → lock).
 */

const MOBILE_FREE_PLAN_ID = 'free_plan';
const MOBILE_FREE_ACCESS_MONTHS = 12;

const MOBILE_CLIENT_HEADER_VALUES = new Set(['mobile', 'abs-mobile', 'expo']);
const MOBILE_APP_HEADER_VALUES = new Set(['abs-mobile', 'mobile']);

/**
 * Detect ABS mobile client from explicit headers / body flag (prefer over UA sniffing).
 * @param {import('express').Request|object|null} req
 * @returns {boolean}
 */
function isMobileSignupClient(req) {
  if (!req) return false;
  const headers = req.headers || {};
  const body = req.body || {};

  const xClient = String(headers['x-client'] || headers['X-Client'] || '')
    .trim()
    .toLowerCase();
  if (MOBILE_CLIENT_HEADER_VALUES.has(xClient)) return true;

  const xApp = String(headers['x-app'] || headers['X-App'] || '')
    .trim()
    .toLowerCase();
  if (MOBILE_APP_HEADER_VALUES.has(xApp)) return true;

  const clientFlag = String(body.client || body.signupClient || '')
    .trim()
    .toLowerCase();
  if (MOBILE_CLIENT_HEADER_VALUES.has(clientFlag) || clientFlag === 'abs-mobile') {
    return true;
  }

  return false;
}

/**
 * @param {{ at?: Date }} [options]
 * @returns {{
 *   channel: 'mobile'|'web',
 *   planId: string,
 *   subscriptionStatus: string,
 *   accessEndsAt: Date,
 *   trialEndsAt: Date,
 *   metadataExtras: object,
 * }}
 */
function buildWebTrialAssignment(options = {}) {
  const at = options.at || new Date();
  const trialEndsAt = dayjs(at).add(DEFAULT_TRIAL_MONTHS, 'month').toDate();
  return {
    channel: 'web',
    planId: 'trial',
    subscriptionStatus: 'trialing',
    accessEndsAt: trialEndsAt,
    trialEndsAt,
    metadataExtras: {
      signupChannel: 'web',
    },
  };
}

/**
 * Resolve plan + access window for a new tenant signup.
 * Ignores client-supplied plan ids (assignment is channel-driven only).
 *
 * @param {object} params
 * @param {import('express').Request|object} [params.req]
 * @param {typeof import('../models').SubscriptionPlan} [params.SubscriptionPlan]
 * @param {Date} [params.at]
 * @param {{ allowMissingFreePlanFallback?: boolean }} [params.options]
 *   When allowMissingFreePlanFallback is true (default), mobile signup falls back to web trial
 *   if `free_plan` is missing/inactive — logged clearly. Set false to throw FREE_PLAN_NOT_CONFIGURED.
 * @returns {Promise<object>}
 */
async function resolveSignupPlanAssignment({
  req,
  SubscriptionPlan,
  at = new Date(),
  options = {},
} = {}) {
  const allowMissingFreePlanFallback = options.allowMissingFreePlanFallback !== false;
  const mobile = isMobileSignupClient(req);

  if (!mobile) {
    return buildWebTrialAssignment({ at });
  }

  let freePlanRow = null;
  if (SubscriptionPlan) {
    freePlanRow = await SubscriptionPlan.findOne({
      where: { planId: MOBILE_FREE_PLAN_ID, isActive: true },
      attributes: ['id', 'planId', 'name', 'isActive'],
    });
  }

  if (!freePlanRow) {
    const message =
      `Mobile signup requires an active SubscriptionPlan with planId "${MOBILE_FREE_PLAN_ID}". ` +
      'Create it in Platform Admin → Subscription Plans (do not use planId "free", which aliases to trial).';

    if (!allowMissingFreePlanFallback) {
      const err = new Error(message);
      err.statusCode = 503;
      err.errorCode = 'FREE_PLAN_NOT_CONFIGURED';
      throw err;
    }

    console.error('[signupPlanAssignment] %s Falling back to web trial.', message);
    const fallback = buildWebTrialAssignment({ at });
    return {
      ...fallback,
      metadataExtras: {
        ...fallback.metadataExtras,
        signupChannel: 'mobile',
        requestedPlanId: MOBILE_FREE_PLAN_ID,
        planAssignmentFallback: 'trial_missing_free_plan',
      },
    };
  }

  // Reuse tenant.trialEndsAt as the complimentary access end for free_plan.
  // subscriptionBillingService treats free_plan specially so mid-year Free tenants
  // are not locked like an unpaid product trial.
  const accessEndsAt = dayjs(at).add(MOBILE_FREE_ACCESS_MONTHS, 'month').toDate();

  return {
    channel: 'mobile',
    planId: MOBILE_FREE_PLAN_ID,
    subscriptionStatus: 'active',
    accessEndsAt,
    trialEndsAt: accessEndsAt,
    metadataExtras: {
      signupChannel: 'mobile',
      // Explicit mirror of trialEndsAt for operators / future migrations.
      accessEndsAt: accessEndsAt.toISOString(),
      freeAccessMonths: MOBILE_FREE_ACCESS_MONTHS,
      freePlanName: freePlanRow.name || 'Free',
    },
  };
}

/**
 * Build the subscription Setting.value payload for a signup assignment.
 * @param {object} assignment - from resolveSignupPlanAssignment
 * @param {object} [extras]
 */
function buildSignupSubscriptionSettingValue(assignment, extras = {}) {
  return {
    plan: assignment.planId,
    status: assignment.subscriptionStatus,
    trialEndsAt: assignment.trialEndsAt,
    paymentMethod: null,
    seats: 1,
    ...(assignment.channel === 'mobile'
      ? {
          accessEndsAt: assignment.accessEndsAt,
          complimentary: true,
          complimentaryReason: 'mobile_signup_free_plan',
        }
      : {}),
    ...extras,
  };
}

module.exports = {
  MOBILE_FREE_PLAN_ID,
  MOBILE_FREE_ACCESS_MONTHS,
  isMobileSignupClient,
  buildWebTrialAssignment,
  resolveSignupPlanAssignment,
  buildSignupSubscriptionSettingValue,
};
