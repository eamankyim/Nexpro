import { STUDIO_LIKE_TYPES, SHOP_TYPES } from './index';

/**
 * Suggested prompts for ABS Assistant (mobile).
 * Prefer getAssistantPromptSets() so chips match business type.
 */

export const ASSISTANT_RETAIL_BUSINESS_PROMPTS = [
  'How much did I sell today?',
  'How are sales this month?',
  'Who owes me money?',
  'What are my top products?',
  'What should I restock?',
  'Why are sales down?',
  'Summarize performance',
];

export const ASSISTANT_STUDIO_BUSINESS_PROMPTS = [
  'How much revenue did I make today?',
  'How is revenue this month?',
  'Who owes me money?',
  'Summarize my open jobs',
  'Which jobs still need attention?',
  'Why is revenue down?',
  'Summarize performance',
];

export const ASSISTANT_RESTAURANT_PROMPTS = [
  'What meals sold best today?',
  'How many kitchen orders are waiting?',
  'What ingredients are running low?',
  "Summarize today's food sales",
  'Who owes me money?',
  'Summarize performance',
];

/** @deprecated Prefer getAssistantPromptSets */
export const ASSISTANT_BUSINESS_PROMPTS = ASSISTANT_RETAIL_BUSINESS_PROMPTS;

export const ASSISTANT_RETAIL_SUPPORT_PROMPTS = [
  'How do I create an invoice?',
  'How do I record a payment?',
  'How do I add an expense?',
  'How do I add a customer?',
  'How do I make a new sale?',
];

export const ASSISTANT_STUDIO_SUPPORT_PROMPTS = [
  'How do I create a job?',
  'How do I create an invoice?',
  'How do I record a payment?',
  'How do I add an expense?',
  'How do I add a customer?',
];

export const ASSISTANT_PHARMACY_SUPPORT_PROMPTS = [
  'How do I create an invoice?',
  'How do I record a payment?',
  'How do I add an expense?',
  'How do I add a customer?',
  'How do I dispense a prescription?',
];

/** @deprecated Prefer getAssistantPromptSets */
export const ASSISTANT_SUPPORT_PROMPTS = ASSISTANT_RETAIL_SUPPORT_PROMPTS;

export const ASSISTANT_RETAIL_DRAFT_PROMPTS = [
  'Draft a payment reminder for overdue customers',
  'Draft a thank-you message for customers',
];

export const ASSISTANT_STUDIO_DRAFT_PROMPTS = [
  'Draft a payment reminder for overdue customers',
  'Draft a thank-you message for customers',
  'Draft a job-ready / pickup notification for a customer',
];

/** @deprecated Prefer getAssistantPromptSets */
export const ASSISTANT_DRAFT_PROMPTS = ASSISTANT_RETAIL_DRAFT_PROMPTS;

export const ASSISTANT_PAGE_PROMPTS: Record<string, string[]> = {
  dashboard: ['Summarize performance', 'What should I restock?', 'Who owes me money?'],
  orders: ['How many orders are in the kitchen?', 'What is taking longest to prepare?'],
  sales: ['How are sales this month?', 'What are my top products?'],
  invoices: ['Who owes me money?', 'Draft a payment reminder'],
  expenses: ['Summarize performance'],
  customers: ['Who owes me money?', 'How are sales this month?'],
  products: ['What is low on stock?', 'What are my top products?'],
  jobs: ['Summarize my open jobs', 'Who owes me money?', 'Summarize performance'],
};

const STOCKISH = /restock|low on stock|stock|inventory|top products|ingredients are running/i;
const PRODUCTISH = /top products|best sellers|sold best/i;

export type AssistantWorkspaceKind = 'studio' | 'restaurant' | 'pharmacy' | 'shop';

export function resolveAssistantWorkspaceKind(
  businessType?: string | null,
  shopType?: string | null
): AssistantWorkspaceKind {
  const type = businessType || 'printing_press';
  if (STUDIO_LIKE_TYPES.includes(type as (typeof STUDIO_LIKE_TYPES)[number])) return 'studio';
  if (type === 'pharmacy') return 'pharmacy';
  if (type === 'shop' && shopType === SHOP_TYPES.RESTAURANT) return 'restaurant';
  if (type === 'shop') return 'shop';
  return 'studio';
}

export function filterPromptsForWorkspace(prompts: string[], kind: AssistantWorkspaceKind): string[] {
  if (!Array.isArray(prompts)) return [];
  if (kind === 'studio') {
    return prompts.filter((p) => !STOCKISH.test(p) && !PRODUCTISH.test(p));
  }
  if (kind === 'shop' || kind === 'pharmacy') {
    return prompts.filter((p) => !/open jobs|job pipeline|create a job|job-ready/i.test(p));
  }
  return prompts;
}

export function getAssistantPromptSets(ctx: {
  businessType?: string | null;
  shopType?: string | null;
} = {}) {
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
      business: ASSISTANT_RESTAURANT_PROMPTS,
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
    kind: 'shop' as const,
    business: ASSISTANT_RETAIL_BUSINESS_PROMPTS,
    support: ASSISTANT_RETAIL_SUPPORT_PROMPTS,
    draft: ASSISTANT_RETAIL_DRAFT_PROMPTS,
  };
}

export function getPagePrompts(
  pageContext: string | undefined,
  opts: { businessType?: string | null; shopType?: string | null; periodLabel?: string } = {}
): string[] {
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
    }
  } else if (kind === 'restaurant' && pageContext === 'orders') {
    base = ASSISTANT_PAGE_PROMPTS.orders;
  }

  return filterPromptsForWorkspace(base, kind);
}
