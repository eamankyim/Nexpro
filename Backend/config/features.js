/**
 * Central Feature Registry
 * 
 * This is the single source of truth for all application features.
 * When you add/remove features, update this file and the system will automatically:
 * - Show them in the plan editor
 * - Enforce access control
 * - Display them on marketing pages
 */

const FEATURE_CATALOG = [
  {
    key: 'crm',
    name: 'Customers',
    description: 'Manage customer records and profiles',
    category: 'core',
    routes: ['/customers'],
    requiredForModules: ['quotes', 'jobs', 'invoices'],
    marketingCopy: {
      highlight: 'Complete CRM for customers & vendors',
      perk: 'Customer & vendor relationship management'
    }
  },
  {
    key: 'vendors',
    name: 'Vendors',
    description: 'Manage suppliers and vendor records',
    category: 'core',
    routes: ['/vendors'],
    requiredForModules: [],
    marketingCopy: {
      highlight: 'Track supplier and vendor relationships',
      perk: 'Vendor management'
    }
  },
  {
    key: 'marketing',
    name: 'Marketing Broadcasts',
    description: 'Send bulk email, SMS, and WhatsApp campaigns',
    category: 'communication',
    routes: ['/marketing'],
    requiredForModules: [],
    marketingCopy: {
      highlight: 'Reach customers with bulk campaigns',
      perk: 'Marketing broadcasts'
    }
  },
  {
    key: 'quoteAutomation',
    name: 'Quote Builder',
    description: 'Create and manage customer quotes',
    category: 'sales',
    routes: ['/quotes'],
    requiredForModules: [],
    marketingCopy: {
      highlight: 'Automated quote generation with pricing templates',
      perk: 'Quote builder with smart pricing'
    }
  },
  {
    key: 'pricingTemplates',
    name: 'Pricing Templates',
    description: 'Manage pricing templates and presets',
    category: 'sales',
    routes: ['/pricing'],
    requiredForModules: [],
    marketingCopy: {
      highlight: 'Reusable pricing templates',
      perk: 'Pricing templates'
    }
  },
  {
    key: 'jobAutomation',
    name: 'Jobs',
    description: 'Track jobs and production workflows',
    category: 'operations',
    routes: ['/jobs'],
    requiredForModules: [],
    marketingCopy: {
      highlight: 'Job workflow with automatic invoice creation',
      perk: 'Auto-generated invoices from jobs'
    }
  },
  {
    key: 'tasks',
    name: 'Tasks',
    description: 'Track team tasks and follow-ups',
    category: 'operations',
    routes: ['/tasks'],
    requiredForModules: [],
    marketingCopy: {
      highlight: 'Task tracking and follow-ups',
      perk: 'Task management'
    }
  },
  {
    key: 'paymentsExpenses',
    name: 'Sales',
    description: 'Record sales transactions and POS flows',
    category: 'finance',
    routes: ['/sales'],
    requiredForModules: [],
    marketingCopy: {
      highlight: 'Comprehensive payment and expense tracking',
      perk: 'Payment recording & expense management'
    }
  },
  {
    key: 'orders',
    name: 'Orders',
    description: 'Manage customer orders',
    category: 'sales',
    routes: ['/orders'],
    requiredForModules: [],
    marketingCopy: {
      highlight: 'Order management',
      perk: 'Customer orders'
    }
  },
  {
    key: 'deliveries',
    name: 'Deliveries / dispatch',
    description: 'Queue completed jobs and sales, update delivery status for customer tracking',
    category: 'operations',
    routes: ['/deliveries'],
    requiredForModules: [],
    marketingCopy: {
      highlight: 'Delivery queue and dispatch status',
      perk: 'Deliveries & dispatch workspace'
    }
  },
  {
    key: 'products',
    name: 'Products',
    description: 'Manage product catalog and stock items',
    category: 'operations',
    routes: ['/products'],
    requiredForModules: [],
    marketingCopy: {
      highlight: 'Product catalog management',
      perk: 'Products module'
    }
  },
  {
    key: 'invoices',
    name: 'Invoices',
    description: 'Create and manage invoices',
    category: 'finance',
    routes: ['/invoices'],
    requiredForModules: [],
    marketingCopy: {
      highlight: 'Invoice management and billing',
      perk: 'Invoices module'
    }
  },
  {
    key: 'expenses',
    name: 'Expenses',
    description: 'Track and approve business expenses',
    category: 'finance',
    routes: ['/expenses'],
    requiredForModules: [],
    marketingCopy: {
      highlight: 'Expense tracking',
      perk: 'Expenses module'
    }
  },
  {
    key: 'shopsModule',
    name: 'Shops',
    description: 'Manage multiple shops',
    category: 'operations',
    routes: ['/shops'],
    requiredForModules: [],
    marketingCopy: {
      highlight: 'Multi-shop management',
      perk: 'Shops module'
    }
  },
  {
    key: 'pharmacyOps',
    name: 'Pharmacy Operations',
    description: 'Pharmacy locations, drugs, and prescriptions',
    category: 'operations',
    routes: ['/pharmacies', '/drugs', '/prescriptions'],
    requiredForModules: [],
    marketingCopy: {
      highlight: 'Full pharmacy workflow',
      perk: 'Pharmacy operations'
    }
  },
  {
    key: 'materials',
    name: 'Materials & Vendor Price Lists',
    description: 'Manage materials, stock levels, and vendor pricing',
    category: 'operations',
    routes: ['/materials', '/equipment', '/inventory', '/assets'],
    requiredForModules: [],
    marketingCopy: {
      highlight: 'Full materials management with vendor price lists',
      perk: 'Materials controls & vendor pricing'
    }
  },
  {
    key: 'reports',
    name: 'Dashboards & Reporting Suite',
    description: 'Advanced analytics and custom reports',
    category: 'analytics',
    routes: ['/reports', '/dashboard'],
    requiredForModules: [],
    marketingCopy: {
      highlight: 'Interactive dashboards and reporting',
      perk: 'Business intelligence dashboards'
    }
  },
  {
    key: 'notifications',
    name: 'In-app Notifications & Alerts',
    description: 'Real-time notifications and automated reminders',
    category: 'communication',
    routes: [],
    requiredForModules: [],
    marketingCopy: {
      highlight: 'Real-time notifications and smart reminders',
      perk: 'Automated notifications & alerts'
    }
  },
  {
    key: 'leadPipeline',
    name: 'Lead Pipeline & Activity Timeline',
    description: 'Track leads and conversion opportunities',
    category: 'sales',
    routes: ['/leads'],
    requiredForModules: [],
    marketingCopy: {
      highlight: 'Visual lead pipeline with activity tracking',
      perk: 'Lead management & conversion tracking'
    }
  },
  {
    key: 'roleManagement',
    name: 'Team Invites & Role-Based Access Control',
    description: 'Manage team members with granular permissions',
    category: 'admin',
    routes: ['/users'],
    requiredForModules: [],
    marketingCopy: {
      highlight: 'Granular role-based access control',
      perk: 'Team invites & permission management'
    }
  },
  {
    key: 'accounting',
    name: 'Full Accounting Module',
    description: 'Chart of accounts, journal entries, financial statements',
    category: 'finance',
    routes: ['/accounting'],
    requiredForModules: [],
    marketingCopy: {
      highlight: 'Complete accounting with chart of accounts',
      perk: 'Full double-entry accounting'
    }
  },
  {
    key: 'payroll',
    name: 'Payroll Management',
    description: 'Employee payroll processing and tracking',
    category: 'hr',
    routes: ['/payroll', '/employees'],
    requiredForModules: [],
    marketingCopy: {
      highlight: 'Built-in payroll processing',
      perk: 'Employee payroll management'
    }
  },
  {
    key: 'advancedReporting',
    name: 'Advanced Analytics & Custom Reports',
    description: 'Deep analytics, custom report builder, data exports',
    category: 'analytics',
    routes: ['/export-data'],
    requiredForModules: ['reports'],
    marketingCopy: {
      highlight: 'Advanced analytics with custom report builder',
      perk: 'Custom reports & data exports'
    }
  },
  {
    key: 'apiAccess',
    name: 'API Access',
    description: 'Programmatic access to platform data',
    category: 'integration',
    routes: [],
    requiredForModules: [],
    marketingCopy: {
      highlight: 'Full API access for integrations',
      perk: 'RESTful API access'
    }
  },
  {
    key: 'whiteLabel',
    name: 'White-Label Branding',
    description: 'Custom branding and domain',
    category: 'enterprise',
    routes: [],
    requiredForModules: [],
    marketingCopy: {
      highlight: 'Custom branding with your domain',
      perk: 'White-label branding & custom domain'
    }
  },
  {
    key: 'sso',
    name: 'Single Sign-On (SSO)',
    description: 'Enterprise SSO integration',
    category: 'enterprise',
    routes: [],
    requiredForModules: [],
    marketingCopy: {
      highlight: 'Enterprise SSO with SAML/OAuth',
      perk: 'Single Sign-On (SSO) integration'
    }
  },
  {
    key: 'customWorkflows',
    name: 'Custom Workflow Configuration',
    description: 'Customize business processes and workflows',
    category: 'enterprise',
    routes: [],
    requiredForModules: [],
    marketingCopy: {
      highlight: 'Fully customizable workflows',
      perk: 'Custom workflow configuration'
    }
  },
  {
    key: 'automations',
    name: 'Automations',
    description: 'Configure workflow automations',
    category: 'operations',
    routes: ['/automations'],
    requiredForModules: [],
    marketingCopy: {
      highlight: 'Automate repetitive operations',
      perk: 'Automation rules'
    }
  },
  {
    key: 'dedicatedSupport',
    name: 'Dedicated Support Manager',
    description: 'Priority support with dedicated account manager',
    category: 'support',
    routes: [],
    requiredForModules: [],
    marketingCopy: {
      highlight: 'Dedicated customer success manager',
      perk: 'Dedicated account manager'
    }
  },
  {
    key: 'sla',
    name: 'Support SLA',
    description: 'Guaranteed response times',
    category: 'support',
    routes: [],
    requiredForModules: [],
    marketingCopy: {
      highlight: 'Priority support with guaranteed SLA',
      perk: 'Support SLA with guaranteed response times'
    }
  }
];

// Feature categories for organization
const FEATURE_CATEGORIES = {
  core: 'Core Features',
  sales: 'Sales & CRM',
  operations: 'Operations',
  finance: 'Finance',
  hr: 'Human Resources',
  analytics: 'Analytics & Reporting',
  communication: 'Communication',
  admin: 'Administration',
  integration: 'Integrations',
  enterprise: 'Enterprise',
  support: 'Support'
};

// Seat limits by plan (null = unlimited) — Paystack naming: starter, professional
const DEFAULT_PLAN_SEAT_LIMITS = {
  trial: 5,
  starter: 5,
  professional: 15,
  enterprise: null, // unlimited
  launch: 5, scale: 15 // legacy aliases
};

// Seat pricing (additional cost per seat beyond base limit)
const PLAN_SEAT_PRICING = {
  trial: null,
  starter: 25,       // GHS 25 per additional seat
  professional: 32,  // GHS 32 per additional seat
  enterprise: null,
  launch: 25, scale: 32 // legacy aliases
};

// Storage limits by plan (in MB, null = unlimited)
const DEFAULT_STORAGE_LIMITS = {
  trial: 1024,
  starter: 10240,     // 10 GB
  professional: 51200, // 50 GB
  enterprise: null,
  launch: 10240, scale: 51200 // legacy aliases
};

// Storage pricing (cost per 100GB beyond base limit)
const STORAGE_PRICING = {
  trial: null,
  starter: 15,
  professional: 12,
  enterprise: null,
  launch: 15, scale: 12 // legacy aliases
};

// Helper functions
const getFeatureByKey = (key) => {
  return FEATURE_CATALOG.find(f => f.key === key);
};

const getFeaturesForPlan = (planId) => {
  const planFeatures = {
    trial: ['crm', 'quoteAutomation', 'jobAutomation', 'paymentsExpenses', 'deliveries', 'invoices', 'expenses', 'reports', 'leadPipeline', 'roleManagement'],
    starter: ['crm', 'vendors', 'marketing', 'quoteAutomation', 'pricingTemplates', 'jobAutomation', 'tasks', 'paymentsExpenses', 'orders', 'deliveries', 'products', 'invoices', 'expenses', 'materials', 'reports', 'leadPipeline', 'roleManagement', 'accounting', 'payroll'],
    professional: ['crm', 'vendors', 'marketing', 'quoteAutomation', 'pricingTemplates', 'jobAutomation', 'tasks', 'paymentsExpenses', 'orders', 'deliveries', 'products', 'invoices', 'expenses', 'materials', 'reports', 'notifications', 'leadPipeline', 'roleManagement', 'accounting', 'payroll', 'advancedReporting', 'automations', 'shopsModule', 'pharmacyOps'],
    enterprise: FEATURE_CATALOG.map(f => f.key),
    launch: ['crm', 'vendors', 'marketing', 'quoteAutomation', 'pricingTemplates', 'jobAutomation', 'tasks', 'paymentsExpenses', 'orders', 'deliveries', 'products', 'invoices', 'expenses', 'materials', 'reports', 'leadPipeline', 'roleManagement', 'accounting', 'payroll'],
    scale: ['crm', 'vendors', 'marketing', 'quoteAutomation', 'pricingTemplates', 'jobAutomation', 'tasks', 'paymentsExpenses', 'orders', 'deliveries', 'products', 'invoices', 'expenses', 'materials', 'reports', 'notifications', 'leadPipeline', 'roleManagement', 'accounting', 'payroll', 'advancedReporting', 'automations', 'shopsModule', 'pharmacyOps']
  };
  return planFeatures[planId] || [];
};

const getFeaturesByCategory = () => {
  const grouped = {};
  FEATURE_CATALOG.forEach(feature => {
    if (!grouped[feature.category]) {
      grouped[feature.category] = [];
    }
    grouped[feature.category].push(feature);
  });
  return grouped;
};

const canAccessFeature = (tenantPlanFeatures, featureKey) => {
  return Array.isArray(tenantPlanFeatures) && tenantPlanFeatures.includes(featureKey);
};

const canAccessRoute = (tenantPlanFeatures, route) => {
  // Find all features that include this route
  const relevantFeatures = FEATURE_CATALOG.filter(f => 
    f.routes.some(r => route.startsWith(r))
  );
  if (relevantFeatures.length === 0) {
    return true;
  }
  
  // Check if tenant has at least one feature that grants access to this route
  return relevantFeatures.some(feature => 
    canAccessFeature(tenantPlanFeatures, feature.key)
  );
};

/**
 * Generate highlights from enabled features
 */
const generateHighlightsFromFeatures = (enabledFeatureKeys) => {
  const highlights = [];
  enabledFeatureKeys.forEach(key => {
    const feature = getFeatureByKey(key);
    if (feature?.marketingCopy?.highlight) {
      highlights.push(feature.marketingCopy.highlight);
    }
  });
  return highlights;
};

/**
 * Generate perks from enabled features
 */
const generatePerksFromFeatures = (enabledFeatureKeys) => {
  const perks = [];
  enabledFeatureKeys.forEach(key => {
    const feature = getFeatureByKey(key);
    if (feature?.marketingCopy?.perk) {
      perks.push(feature.marketingCopy.perk);
    }
  });
  return perks;
};

module.exports = {
  FEATURE_CATALOG,
  FEATURE_CATEGORIES,
  DEFAULT_PLAN_SEAT_LIMITS,
  PLAN_SEAT_PRICING,
  DEFAULT_STORAGE_LIMITS,
  STORAGE_PRICING,
  getFeatureByKey,
  getFeaturesForPlan,
  getFeaturesByCategory,
  canAccessFeature,
  canAccessRoute,
  generateHighlightsFromFeatures,
  generatePerksFromFeatures
};

