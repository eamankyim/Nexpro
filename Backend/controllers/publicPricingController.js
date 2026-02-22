const { plans: configPlans, lastUpdated: configLastUpdated } = require('../config/plans');
const { PLAN_DEFINITIONS } = require('../config/paystackPlans');
const { SubscriptionPlan } = require('../models');

const sortPlans = (collection = []) =>
  [...collection].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

const pesewasToGhs = (p) => (p == null ? null : p / 100);

const mapPlanForOnboarding = (plan) => ({
  id: plan.id,
  value: plan.id,
  title: plan.name,
  subtitle: plan.onboarding?.subtitle || plan.price?.billingPeriodLabel || null,
  price: plan.price?.display || null,
  badge: plan.onboarding?.badge || (plan.marketing?.badgeLabel || null),
  description: plan.description,
  features: plan.highlights || [],
  perks: plan.marketing?.perks || [],
  cta: plan.onboarding?.ctaLabel || 'Select plan',
  isDefault: Boolean(plan.onboarding?.isDefault),
  billingDescription: plan.price?.billingDescription || null,
  priceMeta: plan.price || null
});

const mapPlanForMarketing = (plan, opts = {}) => {
  const { interval = null, priceOverride = null } = opts;
  const price = priceOverride ?? plan.price;
  const displayPrice =
    plan.marketing?.priceDisplay || price?.display || null;
  const cta = plan.marketing?.cta;
  const ctaLabel = typeof cta === 'object' && cta?.label ? cta.label : (cta || 'Start trial');

  return {
    id: plan.id,
    name: plan.name,
    description: plan.description,
    price: displayPrice,
    priceMeta: {
      amount: price?.amount ?? null,
      currency: price?.currency ?? 'GHS',
      display: price?.display ?? displayPrice,
      billingDescription: price?.billingDescription || null
    },
    billing: plan.marketing?.billing || price?.billingDescription || null,
    perks: plan.marketing?.perks || [],
    highlights: plan.highlights || [],
    features: plan.marketing?.featureFlags || {},
    popular: Boolean(plan.marketing?.popular),
    badge: plan.marketing?.badgeLabel || null,
    cta: typeof cta === 'object' ? { ...cta, label: cta.label || ctaLabel } : { label: ctaLabel },
    interval
  };
};

/** Map legacy plan ids to Paystack ids for price lookup */
const PLAN_ID_TO_PAYSTACK = { launch: 'starter', scale: 'professional' };

/** Expand Paystack-backed plans (starter, professional) into monthly + yearly rows for marketing */
function expandMarketingPlansWithPaystack(plans) {
  const expanded = [];
  const paystackIds = ['starter', 'professional'];
  for (const plan of plans) {
    const id = (plan.id || '').toLowerCase();
    const paystackId = PLAN_ID_TO_PAYSTACK[id] || id;
    if (paystackIds.includes(paystackId) && PLAN_DEFINITIONS[paystackId] && !PLAN_DEFINITIONS[paystackId].contactSales) {
      const def = PLAN_DEFINITIONS[paystackId];
      const monthlyAmount = pesewasToGhs(def.monthly);
      const yearlyAmount = pesewasToGhs(def.yearly);
      expanded.push(mapPlanForMarketing(plan, {
        interval: 'monthly',
        priceOverride: {
          amount: monthlyAmount,
          currency: 'GHS',
          display: `GHS ${monthlyAmount}/mo`,
          billingDescription: `GHS ${monthlyAmount} per month`
        }
      }));
      expanded.push(mapPlanForMarketing(plan, {
        interval: 'annually',
        priceOverride: {
          amount: yearlyAmount,
          currency: 'GHS',
          display: `GHS ${(yearlyAmount / 12).toFixed(0)}/mo`,
          billingDescription: `GHS ${(yearlyAmount / 12).toFixed(0)} per month when billed annually`
        }
      }));
    } else {
      expanded.push(mapPlanForMarketing(plan));
    }
  }
  return expanded;
}

exports.getPublicPlans = async (req, res) => {
  try {
    const channel = (req.query.channel || 'all').toLowerCase();

    // Try to fetch plans from database first
    let plans = [];
    let lastUpdated = new Date();
    let source = 'config';

    try {
      const dbPlans = await SubscriptionPlan.findAll({
        where: { isActive: true },
        order: [['order', 'ASC']]
      });

      if (dbPlans && dbPlans.length > 0) {
        // Convert database records to plan objects
        plans = dbPlans.map(record => ({
          id: record.planId,
          order: record.order,
          name: record.name,
          description: record.description,
          price: record.price,
          highlights: record.highlights,
          marketing: record.marketing,
          onboarding: record.onboarding,
          metadata: record.metadata
        }));
        lastUpdated = Math.max(...dbPlans.map(p => new Date(p.updatedAt)));
        source = 'database';
      }
    } catch (dbError) {
      console.warn('Failed to fetch plans from database, falling back to config:', dbError.message);
    }

    // Fallback to config if database is empty or failed
    if (plans.length === 0) {
      plans = configPlans;
      lastUpdated = configLastUpdated;
      source = 'config';
    }

    let dataset;
    switch (channel) {
      case 'marketing': {
        const marketingPlans = sortPlans(
          plans.filter((plan) => plan.marketing?.enabled !== false)
        );
        dataset = expandMarketingPlansWithPaystack(marketingPlans);
        break;
      }
      case 'onboarding':
        dataset = sortPlans(
          plans.filter((plan) => plan.onboarding?.enabled !== false)
        ).map(mapPlanForOnboarding);
        break;
      default:
        dataset = sortPlans(plans);
    }

    res.status(200).json({
      success: true,
      channel,
      count: dataset.length,
      data: dataset,
      lastUpdated,
      source // Shows whether data came from database or config
    });
  } catch (error) {
    console.error('Error fetching public plans:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pricing plans',
      error: error.message
    });
  }
};
