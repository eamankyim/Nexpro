const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');
const { SubscriptionPlan, Setting } = require('../models');
const {
  buildTrialPlanRowPayload,
  buildTrialSubscriptionSettingValue,
  resolveTrialEndDate,
  getTrialPlanFeatureFlags,
} = require('../utils/subscriptionDefaults');

const PAID_PLAN_IDS = new Set(['starter', 'professional', 'enterprise', 'launch', 'scale']);

const isMissingPlan = (plan) => {
  const normalized = String(plan || '').trim().toLowerCase();
  return !normalized || normalized === 'null' || normalized === 'undefined';
};

const isIncompleteFeatureFlags = (featureFlags) => {
  if (!featureFlags || typeof featureFlags !== 'object') {
    return true;
  }
  const canonical = getTrialPlanFeatureFlags();
  const canonicalKeys = Object.keys(canonical);
  if (canonicalKeys.length === 0) {
    return false;
  }
  const enabledCount = canonicalKeys.filter((key) => featureFlags[key] === true).length;
  return enabledCount < canonicalKeys.length;
};

/**
 * Safe backfill:
 * - tenants with missing/null plan -> trial (does NOT touch paid plans)
 * - missing trialEndsAt on trial tenants
 * - missing subscription settings for trial tenants
 * - trial subscription_plans row + all-features featureFlags when missing/incomplete
 */
async function up(options = {}) {
  const { closeConnection = true } = options;

  try {
    const trialPayload = buildTrialPlanRowPayload();
    const [trialPlanRow, createdTrialPlan] = await SubscriptionPlan.findOrCreate({
      where: { planId: 'trial' },
      defaults: trialPayload,
    });

    if (!createdTrialPlan) {
      const marketing = {
        ...(trialPlanRow.marketing && typeof trialPlanRow.marketing === 'object' ? trialPlanRow.marketing : {}),
        featureFlags: trialPayload.marketing.featureFlags,
      };
      const metadata = {
        ...(trialPlanRow.metadata && typeof trialPlanRow.metadata === 'object' ? trialPlanRow.metadata : {}),
        featureFlags: trialPayload.metadata.featureFlags,
        featureKeys: trialPayload.metadata.featureKeys,
      };
      const updates = {};
      if (isIncompleteFeatureFlags(trialPlanRow.marketing?.featureFlags)) {
        updates.marketing = marketing;
        updates.metadata = metadata;
      }
      if (trialPlanRow.seatLimit == null) {
        updates.seatLimit = trialPayload.seatLimit;
      }
      if (trialPlanRow.branchLimit == null) {
        updates.branchLimit = trialPayload.branchLimit;
      }
      if (trialPlanRow.storageLimitMB == null) {
        updates.storageLimitMB = trialPayload.storageLimitMB;
      }
      if (Object.keys(updates).length > 0) {
        await trialPlanRow.update(updates);
      }
    }

    const [planBackfill] = await sequelize.query(`
      UPDATE tenants
      SET plan = 'trial',
          "updatedAt" = NOW()
      WHERE plan IS NULL
         OR TRIM(plan) = ''
         OR LOWER(TRIM(plan)) IN ('null', 'undefined');
    `);
    const planBackfillCount = Number(planBackfill?.rowCount || 0);

    const [trialEndsBackfill] = await sequelize.query(`
      UPDATE tenants
      SET "trialEndsAt" = COALESCE("createdAt", NOW()) + INTERVAL '1 month',
          "updatedAt" = NOW()
      WHERE plan = 'trial'
        AND "trialEndsAt" IS NULL;
    `);
    const trialEndsBackfillCount = Number(trialEndsBackfill?.rowCount || 0);

    const [trialTenants] = await sequelize.query(`
      SELECT id, "trialEndsAt"
      FROM tenants
      WHERE plan = 'trial';
    `);

    let subscriptionSettingsCreated = 0;
    for (const row of trialTenants || []) {
      const existing = await Setting.findOne({
        where: { tenantId: row.id, key: 'subscription' },
      });
      if (existing) {
        continue;
      }
      const trialEndDate = resolveTrialEndDate(row.trialEndsAt);
      await Setting.create({
        tenantId: row.id,
        key: 'subscription',
        value: buildTrialSubscriptionSettingValue(trialEndDate),
        description: 'Subscription and billing information',
      });
      subscriptionSettingsCreated += 1;
    }

    console.log('[Migration] backfill-trial-plan-defaults complete:', {
      trialPlanCreated: createdTrialPlan,
      tenantsPlanBackfilled: planBackfillCount,
      trialEndsAtBackfilled: trialEndsBackfillCount,
      subscriptionSettingsCreated,
      paidPlansPreserved: Array.from(PAID_PLAN_IDS),
    });
  } catch (error) {
    console.error('[Migration] backfill-trial-plan-defaults failed:', error.message);
    throw error;
  } finally {
    if (closeConnection) {
      await sequelize.close();
    }
  }
}

module.exports = { up };

if (require.main === module) {
  up();
}
