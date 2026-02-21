/**
 * Expense categories for platform (admin) internal expenses.
 * Used in Control Panel when creating/viewing expenses with tenantId = null.
 * These are not tenant or business-type dependent.
 */

const ADMIN_EXPENSE_CATEGORIES = [
  'Salaries & Wages',
  'Office Supplies',
  'Software & Subscriptions',
  'Marketing & Advertising',
  'Travel & Accommodation',
  'Utilities',
  'Rent',
  'Legal & Professional Fees',
  'Insurance',
  'Contractors & Freelancers',
  'Equipment',
  'Maintenance & Repairs',
  'Telecommunications',
  'Bank & Transaction Fees',
  'Other'
];

/**
 * Get expense categories for platform admin (internal) expenses
 * @returns {string[]} Array of category names
 */
const getAdminExpenseCategories = () => [...ADMIN_EXPENSE_CATEGORIES];

module.exports = {
  ADMIN_EXPENSE_CATEGORIES,
  getAdminExpenseCategories
};
