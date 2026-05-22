/**
 * Suggested prompts for ABS Assistant (web).
 */
export const ASSISTANT_BUSINESS_PROMPTS = [
  "Summarize today's performance",
  'Who owes me money?',
  'Revenue vs expenses this month',
  'What should I restock?',
  'Predict sales for next week',
];

export const ASSISTANT_SUPPORT_PROMPTS = [
  'How do I create an invoice?',
  'How do I record a payment on an invoice?',
  'How do I add an expense?',
  'How do I add a customer?',
  'How do I run a sale on POS?',
];

export const ASSISTANT_DRAFT_PROMPTS = [
  'Draft a polite payment reminder for overdue customers',
  'Draft a short thank-you message for my best customers',
  'Draft a promotional SMS for my shop',
];

/** Page-specific prompts when opening Ask AI from a module */
export const ASSISTANT_PAGE_PROMPTS = {
  dashboard: ['Summarize this period', 'What should I focus on today?'],
  reports: [
    'Summarize performance for this period',
    'What are my biggest revenue drivers this period?',
    'Where can I cut costs this period?',
  ],
  sales: ['How are sales trending this month?', 'What are my top products?'],
  invoices: ['Who has overdue invoices?', 'Draft a payment reminder'],
  expenses: ['Where am I spending the most?', 'How can I reduce expenses?'],
  customers: ['Who are my top customers?', 'How many new customers this month?'],
  products: ['What products are low on stock?', 'What should I reorder first?'],
  jobs: ['How many jobs are in progress?', 'Which jobs need attention?'],
};
