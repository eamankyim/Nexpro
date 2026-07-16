/**
 * Suggested prompts for ABS Assistant (mobile).
 * Business chips favor owned analysis intents (DB-backed).
 */
export const ASSISTANT_BUSINESS_PROMPTS = [
  "How much did I sell today?",
  'How are sales this month?',
  'Who owes me money?',
  'What are my top products?',
  'What should I restock?',
  'Why are sales down?',
  'Summarize performance',
];

export const ASSISTANT_SUPPORT_PROMPTS = [
  'How do I create an invoice?',
  'How do I record a payment?',
  'How do I add an expense?',
  'How do I add a customer?',
  'How do I make a new sale?',
];

export const ASSISTANT_DRAFT_PROMPTS = [
  'Draft a payment reminder for overdue customers',
  'Draft a thank-you message for customers',
];

export const ASSISTANT_RESTAURANT_PROMPTS = [
  'What meals sold best today?',
  'How many kitchen orders are waiting?',
  'What ingredients are running low?',
  'Summarize today’s food sales',
];

export const ASSISTANT_PAGE_PROMPTS: Record<string, string[]> = {
  dashboard: ['Summarize performance', 'What should I restock?', 'Who owes me money?'],
  orders: ['How many orders are in the kitchen?', 'What is taking longest to prepare?'],
  sales: ['How are sales this month?', 'What are my top products?'],
  invoices: ['Who owes me money?', 'Draft a payment reminder'],
  expenses: ['Summarize performance'],
  customers: ['Who owes me money?', 'How are sales this month?'],
  products: ['What is low on stock?', 'What are my top products?'],
};
