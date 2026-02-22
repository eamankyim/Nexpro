/** Single source of truth: prices from Paystack (see config/paystackPlans.js) */
const { PLAN_DEFINITIONS } = require('./paystackPlans');

const pesewasToGhs = (p) => (p == null ? null : p / 100);

const plans = [
  {
    id: 'trial',
    order: 10,
    name: 'Free Trial',
    description: 'Try every feature with no commitment.',
    price: {
      amount: 0,
      currency: 'GHS',
      display: 'GHS 0',
      billingPeriodLabel: '1 month',
      billingDescription: '1-month full access'
    },
    highlights: ['All modules unlocked', 'Up to 5 team members', 'In-app support'],
    marketing: {
      enabled: false,
      perks: [],
      featureFlags: {},
      popular: false,
      priceDisplay: 'GHS 0',
      billing: '1-month full access',
      cta: {
        type: 'link',
        target: 'signup',
        label: 'Start trial'
      }
    },
    onboarding: {
      enabled: true,
      subtitle: '1 month',
      ctaLabel: 'Start Trial',
      badge: null,
      isDefault: true
    }
  },
  {
    id: 'starter',
    order: 20,
    name: 'Starter',
    description: (PLAN_DEFINITIONS.starter?.description?.monthly) || 'Up to 5 team members.',
    price: {
      amount: pesewasToGhs(PLAN_DEFINITIONS.starter?.monthly ?? 12900),
      currency: 'GHS',
      display: `GHS ${pesewasToGhs(PLAN_DEFINITIONS.starter?.monthly ?? 12900)}/mo`,
      billingPeriodLabel: 'per month',
      billingDescription: `GHS ${pesewasToGhs(PLAN_DEFINITIONS.starter?.yearly ?? 118800) / 12} per month when billed annually`
    },
    highlights: [
      'Unlimited invoices & jobs',
      'Accounting & payroll modules',
      'Customer & vendor portals',
      'Email + chat support'
    ],
    marketing: {
      enabled: true,
      perks: [
        'Up to 5 seats',
        'Quotes turn into jobs automatically',
        'Auto-generated invoices',
        'Email support'
      ],
      featureFlags: {
        crm: true,
        quoteAutomation: true,
        jobAutomation: true,
        paymentsExpenses: true,
        materials: false,
        reports: true,
        notifications: false,
        leadPipeline: true,
        roleManagement: true
      },
      popular: false,
      priceDisplay: `GHS ${pesewasToGhs(PLAN_DEFINITIONS.starter?.monthly ?? 12900)}`,
      billing: 'per month, billed annually',
      badgeLabel: null,
      cta: {
        type: 'link',
        target: 'signup',
        label: 'Start trial'
      }
    },
    onboarding: {
      enabled: true,
      subtitle: 'Recommended',
      ctaLabel: 'Choose Starter',
      badge: null,
      isDefault: false
    }
  },
  {
    id: 'professional',
    order: 30,
    name: 'Professional',
    description: (PLAN_DEFINITIONS.professional?.description?.monthly) || 'Up to 20 team members.',
    price: {
      amount: pesewasToGhs(PLAN_DEFINITIONS.professional?.monthly ?? 25000),
      currency: 'GHS',
      display: `GHS ${pesewasToGhs(PLAN_DEFINITIONS.professional?.monthly ?? 25000)}/mo`,
      billingPeriodLabel: 'per month',
      billingDescription: `GHS ${pesewasToGhs(PLAN_DEFINITIONS.professional?.yearly ?? 238800) / 12} per month when billed annually`
    },
    highlights: [
      'Everything in Starter',
      'Advanced reporting & automation',
      'Materials controls & vendor price lists',
      'Priority support with SLA'
    ],
    marketing: {
      enabled: true,
      perks: [
        'Up to 15 seats',
        'Materials controls & vendor price lists',
        'Automated reminders & notifications',
        'Priority support'
      ],
      featureFlags: {
        crm: true,
        quoteAutomation: true,
        jobAutomation: true,
        paymentsExpenses: true,
        materials: true,
        reports: true,
        notifications: true,
        leadPipeline: true,
        roleManagement: true
      },
      popular: true,
      priceDisplay: `GHS ${pesewasToGhs(PLAN_DEFINITIONS.professional?.monthly ?? 25000)}`,
      billing: 'per month, billed annually',
      badgeLabel: 'Recommended',
      cta: {
        type: 'link',
        target: 'signup',
        label: 'Start trial'
      }
    },
    onboarding: {
      enabled: true,
      subtitle: 'Growth-ready',
      ctaLabel: 'Choose Professional',
      badge: 'Popular',
      isDefault: false
    }
  },
  {
    id: 'enterprise',
    order: 40,
    name: 'Enterprise',
    description: 'Tailored workflows, security, and integrations for large-scale operations.',
    price: {
      amount: null,
      currency: 'GHS',
      display: "Let's talk",
      billingPeriodLabel: 'Custom',
      billingDescription: 'Custom contract, onboarding & integrations'
    },
    highlights: [
      'Dedicated success manager',
      'Custom workflow configuration',
      '24/7 priority support',
      'Unlimited seats'
    ],
    marketing: {
      enabled: true,
      perks: [
        'Unlimited seats',
        'Dedicated success manager',
        'Custom workflow configuration',
        '24/7 priority support'
      ],
      featureFlags: {
        crm: true,
        quoteAutomation: true,
        jobAutomation: true,
        paymentsExpenses: true,
        materials: true,
        reports: true,
        notifications: true,
        leadPipeline: true,
        roleManagement: true
      },
      popular: false,
      priceDisplay: "Let's talk",
      billing: 'Custom contract, onboarding & integrations',
      badgeLabel: null,
      cta: {
        type: 'modal',
        target: 'contact-sales',
        label: 'Contact sales'
      }
    },
    onboarding: {
      enabled: false,
      subtitle: null,
      ctaLabel: null,
      badge: null,
      isDefault: false
    }
  }
];

module.exports = {
  plans,
  lastUpdated: new Date()
};
