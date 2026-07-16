import { STUDIO_LIKE_TYPES } from './studioLikeTypes.js';

/**
 * Suggested prompts for ABS Assistant (web).
 * Prefer getAssistantPromptSets() so chips match business type.
 */

/** Shared retail (shop / pharmacy) business insight chips — includes stock & products. */
export const ASSISTANT_RETAIL_BUSINESS_PROMPTS = [
  'How much did I sell today?',
  'How are sales this month?',
  'Who owes me money?',
  'What are my top products?',
  'What should I restock?',
  'Why are sales down?',
  'Compare this period to the previous period',
  'Summarize performance',
];

/** Studio-like chips — jobs/pipeline wording; no stock/inventory/top products. */
export const ASSISTANT_STUDIO_BUSINESS_PROMPTS = [
  'How much revenue did I make today?',
  'How is revenue this month?',
  'Who owes me money?',
  'Summarize my open jobs',
  'Which jobs still need attention?',
  'Why is revenue down?',
  'Compare this period to the previous period',
  'Summarize performance',
];

/** Restaurant shop-type chips (mobile + web when shopType is restaurant). */
export const ASSISTANT_RESTAURANT_BUSINESS_PROMPTS = [
  'What meals sold best today?',
  'How many kitchen orders are waiting?',
  'What ingredients are running low?',
  "Summarize today's food sales",
  'Who owes me money?',
  'Summarize performance',
];

/** @deprecated Prefer getAssistantPromptSets — kept for any direct imports */
export const ASSISTANT_BUSINESS_PROMPTS = ASSISTANT_RETAIL_BUSINESS_PROMPTS;

export const ASSISTANT_RETAIL_SUPPORT_PROMPTS = [
  'How do I create an invoice?',
  'How do I record a payment on an invoice?',
  'How do I add an expense?',
  'How do I add a customer?',
  'How do I run a sale on POS?',
];

export const ASSISTANT_STUDIO_SUPPORT_PROMPTS = [
  'How do I create a job?',
  'How do I create an invoice?',
  'How do I record a payment on an invoice?',
  'How do I add an expense?',
  'How do I add a customer?',
];

export const ASSISTANT_PHARMACY_SUPPORT_PROMPTS = [
  'How do I create an invoice?',
  'How do I record a payment on an invoice?',
  'How do I add an expense?',
  'How do I add a customer?',
  'How do I dispense a prescription?',
];

/** @deprecated Prefer getAssistantPromptSets */
export const ASSISTANT_SUPPORT_PROMPTS = ASSISTANT_RETAIL_SUPPORT_PROMPTS;

export const ASSISTANT_RETAIL_DRAFT_PROMPTS = [
  'Draft a polite payment reminder for overdue customers',
  'Draft a short thank-you message for my best customers',
  'Draft a promotional SMS for my shop',
];

export const ASSISTANT_STUDIO_DRAFT_PROMPTS = [
  'Draft a polite payment reminder for overdue customers',
  'Draft a short thank-you message for my best customers',
  'Draft a job-ready / pickup notification for a customer',
];

/** @deprecated Prefer getAssistantPromptSets */
export const ASSISTANT_DRAFT_PROMPTS = ASSISTANT_RETAIL_DRAFT_PROMPTS;

/** Page-specific prompts when opening Ask AI from a module (filtered by type in getPagePrompts). */
export const ASSISTANT_PAGE_PROMPTS = {
  dashboard: ['Summarize performance', 'What should I restock?', 'Who owes me money?'],
  reports: [
    'Summarize performance for this period',
    'Compare this period to the previous period',
    'Why are sales down?',
  ],
  sales: ['How are sales this month?', 'What are my top products?'],
  invoices: ['Who owes me money?', 'Draft a payment reminder'],
  expenses: ['How are sales this month?', 'Summarize performance'],
  customers: ['Who owes me money?', 'How are sales this month?'],
  products: ['What products are low on stock?', 'What are my top products?'],
  jobs: ['Summarize my open jobs', 'Who owes me money?', 'Summarize performance'],
};

const STOCKISH = /restock|low on stock|stock|inventory|top products|ingredients are running/i;
const PRODUCTISH = /top products|best sellers|sold best/i;

/**
 * @param {string|null|undefined} businessType
 * @param {string|null|undefined} shopType
 * @returns {'studio'|'restaurant'|'pharmacy'|'shop'}
 */
export function resolveAssistantWorkspaceKind(businessType, shopType) {
  const type = businessType || 'printing_press';
  if (STUDIO_LIKE_TYPES.includes(type)) return 'studio';
  if (type === 'pharmacy') return 'pharmacy';
  if (type === 'shop' && shopType === 'restaurant') return 'restaurant';
  if (type === 'shop') return 'shop';
  return 'studio';
}

/**
 * Filter prompts that don't apply to the workspace (e.g. stock for studios).
 * @param {string[]} prompts
 * @param {'studio'|'restaurant'|'pharmacy'|'shop'} kind
 * @returns {string[]}
 */
export function filterPromptsForWorkspace(prompts, kind) {
  if (!Array.isArray(prompts)) return [];
  if (kind === 'studio') {
    return prompts.filter((p) => !STOCKISH.test(p) && !PRODUCTISH.test(p));
  }
  if (kind === 'shop' || kind === 'pharmacy') {
    return prompts.filter((p) => !/open jobs|job pipeline|create a job|job-ready/i.test(p));
  }
  return prompts;
}

/**
 * Context-aware chip sets for Ask AI home / floating panel.
 * @param {{ businessType?: string|null, shopType?: string|null }} [ctx]
 * @returns {{
 *   kind: string,
 *   business: string[],
 *   support: string[],
 *   draft: string[],
 * }}
 */
export function getAssistantPromptSets(ctx = {}) {
  const kind = resolveAssistantWorkspaceKind(ctx.businessType, ctx.shopType);

  if (kind === 'studio') {
    return {
      kind,
      business: ASSISTANT_STUDIO_BUSINESS_PROMPTS,
      support: ASSISTANT_STUDIO_SUPPORT_PROMPTS,
      draft: ASSISTANT_STUDIO_DRAFT_PROMPTS,
    };
  }
  if (kind === 'restaurant') {
    return {
      kind,
      business: ASSISTANT_RESTAURANT_BUSINESS_PROMPTS,
      support: ASSISTANT_RETAIL_SUPPORT_PROMPTS,
      draft: ASSISTANT_RETAIL_DRAFT_PROMPTS,
    };
  }
  if (kind === 'pharmacy') {
    return {
      kind,
      business: ASSISTANT_RETAIL_BUSINESS_PROMPTS.map((p) =>
        p === 'What should I restock?' ? 'What drugs or products are low on stock?' : p
      ),
      support: ASSISTANT_PHARMACY_SUPPORT_PROMPTS,
      draft: ASSISTANT_RETAIL_DRAFT_PROMPTS,
    };
  }
  return {
    kind: 'shop',
    business: ASSISTANT_RETAIL_BUSINESS_PROMPTS,
    support: ASSISTANT_RETAIL_SUPPORT_PROMPTS,
    draft: ASSISTANT_RETAIL_DRAFT_PROMPTS,
  };
}

/**
 * Page-context chips filtered for business type.
 * @param {string|undefined} pageContext
 * @param {{ businessType?: string|null, shopType?: string|null, periodLabel?: string }} [opts]
 * @returns {string[]}
 */
export function getPagePrompts(pageContext, opts = {}) {
  if (!pageContext) return [];
  const kind = resolveAssistantWorkspaceKind(opts.businessType, opts.shopType);
  let base = [...(ASSISTANT_PAGE_PROMPTS[pageContext] || [])];

  if (kind === 'studio') {
    if (pageContext === 'dashboard') {
      base = ['Summarize performance', 'Summarize my open jobs', 'Who owes me money?'];
    } else if (pageContext === 'sales') {
      base = ['How is revenue this month?', 'Summarize performance'];
    } else if (pageContext === 'products') {
      base = ['Summarize performance', 'Who owes me money?'];
    } else if (pageContext === 'reports') {
      base = [
        `Summarize performance for ${opts.periodLabel || 'this period'}`,
        'Compare this period to the previous period',
        'Why is revenue down?',
      ];
    }
  }

  return filterPromptsForWorkspace(base, kind);
}
