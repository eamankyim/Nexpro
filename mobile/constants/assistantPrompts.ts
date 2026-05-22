/**
 * Suggested prompts for ABS Assistant (mobile).
 */
export const ASSISTANT_BUSINESS_PROMPTS = [
  "Summarize today's performance",
  'Who owes me money?',
  'Revenue vs expenses this month',
  'What should I restock?',
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
  dashboard: ['Summarize this month', 'What should I focus on today?'],
  orders: ['How many orders are in the kitchen?', 'What is taking longest to prepare?'],
  sales: ['How are sales this month?', 'Top products this month'],
  invoices: ['Who owes me money?', 'Draft a payment reminder'],
  expenses: ['Summarize my expenses this month'],
  customers: ['How many customers do I have?', 'Top customers'],
  products: ['What is low on stock?'],
};
