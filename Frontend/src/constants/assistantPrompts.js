/**
 * Suggested prompts for ABS Assistant (web).
 * Business chips favor owned analysis intents (DB-backed).
 */
export const ASSISTANT_BUSINESS_PROMPTS = [
  "How much did I sell today?",
  'How are sales this month?',
  'Who owes me money?',
  'What are my top products?',
  'What should I restock?',
  'Why are sales down?',
  'Compare this period to the previous period',
  'Summarize performance',
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
  jobs: ['Summarize performance', 'Who owes me money?'],
};
