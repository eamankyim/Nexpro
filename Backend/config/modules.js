/**
 * Module-based Feature Organization for Subscription Pricing
 * 
 * Modules are high-level groupings that can be toggled on/off as a unit.
 * This makes it easier for admins to create pricing tiers.
 */

const MODULES = [
  {
    key: 'crm',
    name: 'CRM & Contacts',
    description: 'Customer and vendor relationship management',
    icon: 'contacts',
    category: 'core',
    features: [
      {
        key: 'crm',
        name: 'Customer & Vendor CRM',
        description: 'Manage customers and vendors',
        routes: ['/customers', '/vendors'],
        marketingCopy: {
          highlight: 'Complete CRM for customers & vendors',
          perk: 'Unlimited customers & vendors'
        }
      },
      {
        key: 'leadPipeline',
        name: 'Lead Pipeline & Activity Timeline',
        description: 'Track leads and conversion opportunities',
        routes: ['/leads'],
        marketingCopy: {
          highlight: 'Visual lead pipeline with activity tracking',
          perk: 'Lead management & conversion tracking'
        }
      }
    ]
  },
  {
    key: 'sales',
    name: 'Sales & Quoting',
    description: 'Quote generation, pricing, and sales tracking',
    icon: 'dollar',
    category: 'core',
    features: [
      {
        key: 'quoteBuilder',
        name: 'Quote Builder',
        description: 'Create and manage quotes',
        routes: ['/quotes'],
        marketingCopy: {
          highlight: 'Professional quote generation',
          perk: 'Unlimited quotes'
        }
      },
      {
        key: 'pricingTemplates',
        name: 'Pricing Templates',
        description: 'Automated pricing with templates and calculators',
        routes: ['/pricing'],
        limits: { trial: 5, launch: 25, scale: 100, enterprise: null },
        marketingCopy: {
          highlight: 'Smart pricing calculator with templates',
          perk: 'Pricing templates & calculators'
        }
      },
      {
        key: 'discountTiers',
        name: 'Quantity Discount Tiers',
        description: 'Automatic volume-based discounts',
        routes: [],
        marketingCopy: {
          highlight: 'Automated quantity discounts',
          perk: 'Volume pricing automation'
        }
      },
      {
        key: 'quoteToJobConversion',
        name: 'Quote-to-Job Conversion',
        description: 'Convert accepted quotes to jobs instantly',
        routes: [],
        marketingCopy: {
          highlight: 'One-click quote-to-job conversion',
          perk: 'Automated quote conversion'
        }
      }
    ]
  },
  {
    key: 'operations',
    name: 'Job Management',
    description: 'Job workflow, tracking, and execution',
    icon: 'setting',
    category: 'core',
    features: [
      {
        key: 'jobWorkflow',
        name: 'Job Workflow & Tracking',
        description: 'Complete job management system',
        routes: ['/jobs'],
        marketingCopy: {
          highlight: 'End-to-end job workflow management',
          perk: 'Unlimited jobs & tracking'
        }
      },
      {
        key: 'jobStatusHistory',
        name: 'Job Status History',
        description: 'Complete audit trail of job status changes',
        routes: [],
        marketingCopy: {
          highlight: 'Complete job status audit trail',
          perk: 'Job history tracking'
        }
      },
      {
        key: 'documentExport',
        name: 'PDF Export',
        description: 'Export invoices, quotes, and reports as PDF',
        routes: [],
        marketingCopy: {
          highlight: 'Professional PDF export',
          perk: 'Branded PDF invoices & quotes'
        }
      }
    ]
  },
  {
    key: 'inventory',
    name: 'Inventory & Vendors',
    description: 'Inventory tracking and vendor management',
    icon: 'appstore',
    category: 'operations',
    features: [
      {
        key: 'inventoryTracking',
        name: 'Inventory Tracking',
        description: 'Track stock levels and movements',
        routes: ['/inventory'],
        marketingCopy: {
          highlight: 'Real-time inventory tracking',
          perk: 'Inventory management system'
        }
      },
      {
        key: 'vendorPriceLists',
        name: 'Vendor Price Lists',
        description: 'Manage vendor pricing and compare costs',
        routes: ['/vendor-price-lists'],
        marketingCopy: {
          highlight: 'Vendor price list management',
          perk: 'Track & compare vendor pricing'
        }
      }
    ]
  },
  {
    key: 'finance',
    name: 'Finance & Billing',
    description: 'Payments, expenses, and invoicing',
    icon: 'dollar-circle',
    category: 'finance',
    features: [
      {
        key: 'payments',
        name: 'Payment Tracking',
        description: 'Record and track payments',
        routes: ['/payments'],
        marketingCopy: {
          highlight: 'Comprehensive payment tracking',
          perk: 'Payment recording & reconciliation'
        }
      },
      {
        key: 'expenses',
        name: 'Expense Management',
        description: 'Track and categorize expenses',
        routes: ['/expenses'],
        marketingCopy: {
          highlight: 'Expense tracking & categorization',
          perk: 'Business expense management'
        }
      },
      {
        key: 'invoicing',
        name: 'Invoicing',
        description: 'Create and manage invoices',
        routes: ['/invoices'],
        marketingCopy: {
          highlight: 'Professional invoicing system',
          perk: 'Unlimited invoices'
        }
      },
      {
        key: 'autoInvoicing',
        name: 'Auto Invoice Generation',
        description: 'Automatically generate invoices from completed jobs',
        routes: [],
        marketingCopy: {
          highlight: 'Invoices auto-generated from jobs',
          perk: 'Automated billing'
        }
      },
      {
        key: 'invoiceCustomization',
        name: 'Invoice Customization',
        description: 'Custom invoice templates and numbering',
        routes: [],
        marketingCopy: {
          highlight: 'Fully customizable invoice templates',
          perk: 'Custom invoice branding'
        }
      },
      {
        key: 'invoiceReminders',
        name: 'Invoice Reminders',
        description: 'Automated payment reminders',
        routes: [],
        marketingCopy: {
          highlight: 'Automated payment reminders',
          perk: 'Auto payment follow-ups'
        }
      }
    ]
  },
  {
    key: 'accounting',
    name: 'Accounting',
    description: 'Full accounting system with chart of accounts',
    icon: 'bar-chart',
    category: 'finance',
    features: [
      {
        key: 'chartOfAccounts',
        name: 'Chart of Accounts',
        description: 'Complete accounting with COA',
        routes: ['/accounting'],
        marketingCopy: {
          highlight: 'Complete chart of accounts',
          perk: 'Full double-entry accounting'
        }
      },
      {
        key: 'accountingAutomation',
        name: 'Accounting Automation',
        description: 'Auto journal entries from invoices and payments',
        routes: [],
        marketingCopy: {
          highlight: 'Automated journal entries',
          perk: 'Accounting automation'
        }
      }
    ]
  },
  {
    key: 'payroll',
    name: 'Payroll & HR',
    description: 'Employee payroll and HR management',
    icon: 'team',
    category: 'hr',
    features: [
      {
        key: 'employeeManagement',
        name: 'Employee Records',
        description: 'Manage employee profiles and documents',
        routes: ['/employees'],
        limits: { trial: 5, launch: 20, scale: 50, enterprise: null },
        marketingCopy: {
          highlight: 'Employee record management',
          perk: 'Employee profiles & documents'
        }
      },
      {
        key: 'payrollProcessing',
        name: 'Payroll Processing',
        description: 'Calculate and process payroll',
        routes: ['/payroll'],
        marketingCopy: {
          highlight: 'Built-in payroll processing',
          perk: 'Automated payroll calculations'
        }
      }
    ]
  },
  {
    key: 'analytics',
    name: 'Analytics & Reports',
    description: 'Business intelligence and reporting',
    icon: 'line-chart',
    category: 'analytics',
    features: [
      {
        key: 'basicReports',
        name: 'Basic Reports & Dashboard',
        description: 'Standard dashboard and basic reports',
        routes: ['/dashboard', '/reports'],
        marketingCopy: {
          highlight: 'Real-time dashboard with KPIs',
          perk: 'Business dashboard'
        }
      },
      {
        key: 'advancedDashboard',
        name: 'Advanced Dashboard Filters',
        description: 'Custom date ranges and multi-period analysis',
        routes: [],
        marketingCopy: {
          highlight: 'Custom date range analytics',
          perk: 'Advanced dashboard filters'
        }
      },
      {
        key: 'salesReports',
        name: 'Sales Analytics',
        description: 'Detailed sales reports and customer analysis',
        routes: ['/reports/sales'],
        marketingCopy: {
          highlight: 'Comprehensive sales analytics',
          perk: 'Sales performance reports'
        }
      },
      {
        key: 'arReports',
        name: 'AR & Outstanding Payments',
        description: 'Accounts receivable aging and collection tracking',
        routes: ['/reports/outstanding-payments'],
        marketingCopy: {
          highlight: 'AR aging and collection reports',
          perk: 'Outstanding payment tracking'
        }
      },
      {
        key: 'profitLossReports',
        name: 'Profit & Loss Statements',
        description: 'Financial P&L statements',
        routes: ['/reports/profit-loss'],
        marketingCopy: {
          highlight: 'Professional P&L statements',
          perk: 'Financial performance reports'
        }
      },
      {
        key: 'dataExport',
        name: 'Data Export',
        description: 'Export data to CSV and Excel',
        routes: [],
        marketingCopy: {
          highlight: 'Export all data to CSV/Excel',
          perk: 'Full data export capabilities'
        }
      }
    ]
  },
  {
    key: 'automation',
    name: 'Automation',
    description: 'Workflow automation and batch processing',
    icon: 'robot',
    category: 'premium',
    features: [
      {
        key: 'quoteToJobConversion',
        name: 'Quote-to-Job Automation',
        description: 'Auto-convert accepted quotes to jobs',
        routes: [],
        marketingCopy: {
          highlight: 'Automated quote-to-job conversion',
          perk: 'One-click quote conversion'
        }
      },
      {
        key: 'autoInvoicing',
        name: 'Auto Invoice Generation',
        description: 'Auto-generate invoices from completed jobs',
        routes: [],
        marketingCopy: {
          highlight: 'Auto-generated invoices',
          perk: 'Automated billing from jobs'
        }
      },
      {
        key: 'accountingAutomation',
        name: 'Accounting Automation',
        description: 'Auto journal entries and reconciliation',
        routes: [],
        marketingCopy: {
          highlight: 'Automated accounting entries',
          perk: 'Auto journal entries'
        }
      },
      {
        key: 'invoiceReminders',
        name: 'Invoice Reminders',
        description: 'Automated payment reminder emails',
        routes: [],
        marketingCopy: {
          highlight: 'Automated payment reminders',
          perk: 'Auto payment follow-ups'
        }
      },
      {
        key: 'bulkOperations',
        name: 'Bulk Operations',
        description: 'Batch update multiple records',
        routes: [],
        marketingCopy: {
          highlight: 'Bulk update jobs and invoices',
          perk: 'Batch processing tools'
        }
      }
    ]
  },
  {
    key: 'communication',
    name: 'Communication',
    description: 'Notifications and alerts',
    icon: 'mail',
    category: 'premium',
    features: [
      {
        key: 'inAppNotifications',
        name: 'In-App Notifications',
        description: 'Real-time in-app alerts',
        routes: [],
        marketingCopy: {
          highlight: 'Real-time in-app notifications',
          perk: 'In-app alerts'
        }
      },
      {
        key: 'emailNotifications',
        name: 'Email Notifications',
        description: 'Email alerts for key events',
        routes: [],
        limits: { trial: 0, launch: 50, scale: 500, enterprise: null },
        marketingCopy: {
          highlight: 'Automated email notifications',
          perk: 'Email alerts & updates'
        }
      },
      {
        key: 'smsNotifications',
        name: 'SMS Notifications',
        description: 'SMS alerts for critical events',
        routes: [],
        limits: { trial: 0, launch: 0, scale: 100, enterprise: null },
        marketingCopy: {
          highlight: 'SMS alerts for urgent updates',
          perk: 'SMS notification service'
        }
      }
    ]
  },
  {
    key: 'customerExperience',
    name: 'Customer Experience',
    description: 'Client-facing features and portals',
    icon: 'star',
    category: 'premium',
    features: [
      {
        key: 'customerPortal',
        name: 'Customer Portal',
        description: 'Self-service portal for customers',
        routes: ['/portal/customer'],
        marketingCopy: {
          highlight: 'Customer self-service portal',
          perk: 'Client portal access'
        }
      },
      {
        key: 'vendorPortal',
        name: 'Vendor Portal',
        description: 'Self-service portal for vendors',
        routes: ['/portal/vendor'],
        marketingCopy: {
          highlight: 'Vendor collaboration portal',
          perk: 'Vendor portal access'
        }
      },
      {
        key: 'customBranding',
        name: 'Custom Branding',
        description: 'Upload logo and customize documents',
        routes: [],
        marketingCopy: {
          highlight: 'Custom logo on all documents',
          perk: 'Professional branding'
        }
      }
    ]
  },
  {
    key: 'teamCollaboration',
    name: 'Team & Permissions',
    description: 'User management and access control',
    icon: 'lock',
    category: 'admin',
    features: [
      {
        key: 'roleManagement',
        name: 'Role-Based Access Control',
        description: 'Granular permissions and roles',
        routes: ['/users'],
        marketingCopy: {
          highlight: 'Granular role-based permissions',
          perk: 'Team access control'
        }
      },
      {
        key: 'teamInvites',
        name: 'Team Invites',
        description: 'Invite team members via email',
        routes: [],
        marketingCopy: {
          highlight: 'Easy team member onboarding',
          perk: 'Team invite system'
        }
      },
      {
        key: 'multiTenancy',
        name: 'Multi-Workspace Access',
        description: 'Users can belong to multiple workspaces',
        routes: [],
        marketingCopy: {
          highlight: 'Access multiple workspaces',
          perk: 'Multi-workspace support'
        }
      }
    ]
  },
  {
    key: 'integration',
    name: 'Integration & API',
    description: 'API access and integrations',
    icon: 'api',
    category: 'enterprise',
    features: [
      {
        key: 'apiAccess',
        name: 'REST API Access',
        description: 'Programmatic access to all data',
        routes: [],
        marketingCopy: {
          highlight: 'Full REST API access',
          perk: 'Developer API access'
        }
      },
      {
        key: 'webhooks',
        name: 'Webhooks',
        description: 'Real-time event notifications',
        routes: [],
        marketingCopy: {
          highlight: 'Real-time webhook integrations',
          perk: 'Webhook support'
        }
      }
    ]
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    description: 'Enterprise-grade features',
    icon: 'bank',
    category: 'enterprise',
    features: [
      {
        key: 'whiteLabel',
        name: 'White-Label Branding',
        description: 'Custom domain and full branding',
        routes: [],
        marketingCopy: {
          highlight: 'White-label with custom domain',
          perk: 'Complete white-labeling'
        }
      },
      {
        key: 'sso',
        name: 'Single Sign-On (SSO)',
        description: 'Enterprise SSO integration',
        routes: [],
        marketingCopy: {
          highlight: 'Enterprise SSO (SAML/OAuth)',
          perk: 'SSO authentication'
        }
      },
      {
        key: 'customWorkflows',
        name: 'Custom Workflows',
        description: 'Configure custom business processes',
        routes: [],
        marketingCopy: {
          highlight: 'Fully customizable workflows',
          perk: 'Custom workflow engine'
        }
      },
      {
        key: 'customFields',
        name: 'Custom Fields',
        description: 'Add custom fields to any record',
        routes: [],
        marketingCopy: {
          highlight: 'Custom fields on all modules',
          perk: 'Unlimited custom fields'
        }
      }
    ]
  },
  {
    key: 'support',
    name: 'Support & Success',
    description: 'Support levels and SLA',
    icon: 'customer-service',
    category: 'support',
    features: [
      {
        key: 'standardSupport',
        name: 'Standard Support',
        description: 'Email support with 48hr response',
        routes: [],
        marketingCopy: {
          highlight: 'Email support',
          perk: '48-hour email support'
        }
      },
      {
        key: 'prioritySupport',
        name: 'Priority Support',
        description: 'Priority support with 24hr response',
        routes: [],
        marketingCopy: {
          highlight: 'Priority support',
          perk: '24-hour priority support'
        }
      },
      {
        key: 'dedicatedSupport',
        name: 'Dedicated Success Manager',
        description: 'Dedicated account manager',
        routes: [],
        marketingCopy: {
          highlight: 'Dedicated customer success manager',
          perk: 'Dedicated account manager'
        }
      },
      {
        key: 'sla',
        name: 'Support SLA',
        description: 'Guaranteed response times',
        routes: [],
        marketingCopy: {
          highlight: '2-hour response SLA',
          perk: 'Guaranteed SLA'
        }
      }
    ]
  }
];

// Flatten all features for easy lookup
const ALL_FEATURES = MODULES.reduce((acc, module) => {
  module.features.forEach(feature => {
    acc.push({
      ...feature,
      moduleKey: module.key,
      moduleName: module.name,
      moduleIcon: module.icon
    });
  });
  return acc;
}, []);

// Get module by key
const getModuleByKey = (key) => {
  return MODULES.find(m => m.key === key);
};

// Get features for a module
const getFeaturesForModule = (moduleKey) => {
  const module = getModuleByKey(moduleKey);
  return module ? module.features : [];
};

// Check if all features in a module are enabled
const isModuleFullyEnabled = (moduleKey, enabledFeatureKeys) => {
  const features = getFeaturesForModule(moduleKey);
  return features.every(f => enabledFeatureKeys.includes(f.key));
};

// Get all enabled modules for a plan
const getEnabledModules = (enabledFeatureKeys) => {
  return MODULES.filter(module => {
    const allFeaturesEnabled = module.features.every(f => 
      enabledFeatureKeys.includes(f.key)
    );
    return allFeaturesEnabled;
  });
};

// Generate highlights from enabled modules
const generateHighlightsFromModules = (enabledModuleKeys) => {
  const highlights = [];
  enabledModuleKeys.forEach(moduleKey => {
    const module = getModuleByKey(moduleKey);
    if (module) {
      module.features.forEach(feature => {
        if (feature.marketingCopy?.highlight) {
          highlights.push(feature.marketingCopy.highlight);
        }
      });
    }
  });
  return highlights;
};

// Generate perks from enabled modules
const generatePerksFromModules = (enabledModuleKeys) => {
  const perks = [];
  enabledModuleKeys.forEach(moduleKey => {
    const module = getModuleByKey(moduleKey);
    if (module) {
      // Add module-level perk
      perks.push(module.name);
    }
  });
  return perks;
};

module.exports = {
  MODULES,
  ALL_FEATURES,
  getModuleByKey,
  getFeaturesForModule,
  isModuleFullyEnabled,
  getEnabledModules,
  generateHighlightsFromModules,
  generatePerksFromModules
};

