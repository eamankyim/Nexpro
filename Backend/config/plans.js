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
      billingPeriodLabel: '14 days',
      billingDescription: '14-day full access'
    },
    highlights: ['All modules unlocked', 'Up to 5 team members', 'In-app support'],
    marketing: {
      enabled: false,
      perks: [],
      featureFlags: {},
      popular: false,
      priceDisplay: 'GHS 0',
      billing: '14-day full access',
      cta: {
        type: 'link',
        target: 'signup',
        label: 'Start trial'
      }
    },
    onboarding: {
      enabled: true,
      subtitle: '14 days',
      ctaLabel: 'Start Trial',
      badge: null,
      isDefault: true
    }
  },
  {
    id: 'launch',
    order: 20,
    name: 'Launch',
    description: 'For growing shops modernizing their quoting and job tracking.',
    price: {
      amount: 799,
      currency: 'GHS',
      display: 'GHS 799/mo',
      billingPeriodLabel: 'per month',
      billingDescription: 'GHS 799 per month, billed annually'
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
        inventory: false,
        reports: true,
        notifications: false,
        leadPipeline: true,
        roleManagement: true
      },
      popular: false,
      priceDisplay: 'GHS 799',
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
      ctaLabel: 'Choose Launch',
      badge: null,
      isDefault: false
    }
  },
  {
    id: 'scale',
    order: 30,
    name: 'Scale',
    description: 'End-to-end visibility for multi-press teams that need deeper controls.',
    price: {
      amount: 1299,
      currency: 'GHS',
      display: 'GHS 1,299/mo',
      billingPeriodLabel: 'per month',
      billingDescription: 'GHS 1,299 per month, billed annually'
    },
    highlights: [
      'Everything in Launch',
      'Advanced reporting & automation',
      'Inventory controls & vendor price lists',
      'Priority support with SLA'
    ],
    marketing: {
      enabled: true,
      perks: [
        'Up to 15 seats',
        'Inventory controls & vendor price lists',
        'Automated reminders & notifications',
        'Priority support'
      ],
      featureFlags: {
        crm: true,
        quoteAutomation: true,
        jobAutomation: true,
        paymentsExpenses: true,
        inventory: true,
        reports: true,
        notifications: true,
        leadPipeline: true,
        roleManagement: true
      },
      popular: true,
      priceDisplay: 'GHS 1,299',
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
      subtitle: 'Scale-ready',
      ctaLabel: 'Choose Scale',
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
        inventory: true,
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
