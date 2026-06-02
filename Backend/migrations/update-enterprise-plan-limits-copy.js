const { sequelize } = require('../config/database');
const { plans } = require('../config/plans');
const {
  DEFAULT_PLAN_SEAT_LIMITS,
  DEFAULT_PLAN_BRANCH_LIMITS,
  PLAN_SEAT_PRICING,
} = require('../config/features');

async function updateEnterprisePlanLimitsCopy() {
  const enterprisePlan = plans.find((plan) => plan.id === 'enterprise');
  if (!enterprisePlan) {
    console.log('Enterprise plan config missing; skipping enterprise limits/copy update');
    return;
  }

  const [results] = await sequelize.query(`
    SELECT to_regclass('public.subscription_plans') AS "tableName";
  `);

  if (!results?.[0]?.tableName) {
    console.log('subscription_plans table missing; skipping enterprise limits/copy update');
    return;
  }

  await sequelize.query(
    `
      UPDATE subscription_plans
      SET
        "highlights" = CAST(:highlights AS jsonb),
        "marketing" = CAST(:marketing AS jsonb),
        "seatLimit" = :seatLimit,
        "seatPricePerAdditional" = :seatPricePerAdditional,
        "branchLimit" = :branchLimit,
        "updatedAt" = NOW()
      WHERE "planId" = 'enterprise';
    `,
    {
      replacements: {
        highlights: JSON.stringify(enterprisePlan.highlights || []),
        marketing: JSON.stringify(enterprisePlan.marketing || {}),
        seatLimit: DEFAULT_PLAN_SEAT_LIMITS.enterprise,
        seatPricePerAdditional: PLAN_SEAT_PRICING.enterprise,
        branchLimit: DEFAULT_PLAN_BRANCH_LIMITS.enterprise,
      },
    }
  );

  console.log('[Migration] Enterprise plan limits and pricing copy updated');
}

module.exports = updateEnterprisePlanLimitsCopy;

if (require.main === module) {
  updateEnterprisePlanLimitsCopy()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
