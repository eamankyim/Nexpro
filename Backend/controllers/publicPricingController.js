const { plans: configPlans, lastUpdated: configLastUpdated } = require('../config/plans');
const { SubscriptionPlan } = require('../models');

const sortPlans = (collection = []) =>
  [...collection].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

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

const mapPlanForMarketing = (plan) => {
  const displayPrice =
    plan.marketing?.priceDisplay || plan.price?.display || null;

  return {
    id: plan.id,
    name: plan.name,
    description: plan.description,
    price: displayPrice,
    priceMeta: {
      amount: plan.price?.amount ?? null,
      currency: plan.price?.currency ?? null,
      display: plan.price?.display ?? displayPrice
    },
    billing: plan.marketing?.billing || plan.price?.billingDescription || null,
    perks: plan.marketing?.perks || [],
    features: plan.marketing?.featureFlags || {},
    popular: Boolean(plan.marketing?.popular),
    badge: plan.marketing?.badgeLabel || null,
    cta: plan.marketing?.cta || null
  };
};

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
      case 'marketing':
        dataset = sortPlans(
          plans.filter((plan) => plan.marketing?.enabled !== false)
        ).map(mapPlanForMarketing);
        break;
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
