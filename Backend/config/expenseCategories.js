/**
 * Expense Categories by Business Type and Shop/Studio Type
 *
 * Expense categories vary by:
 * - businessType: shop, studio, pharmacy
 * - shopType: for shop (supermarket, hardware, electronics, etc.)
 * - studioType: for studio (printing_press, mechanic, barber, salon)
 */

const { resolveBusinessType } = require('./businessTypes');

const EXPENSE_CATEGORIES = {
  shop: {
    supermarket: [
      'Produce',
      'Dairy',
      'Meat & Seafood',
      'Beverages',
      'Bakery',
      'Frozen Foods',
      'Utilities',
      'Rent',
      'Labor',
      'Equipment',
      'Marketing',
      'Transportation',
      'Other'
    ],
    hardware: [
      'Building Materials',
      'Tools & Equipment',
      'Electrical Supplies',
      'Plumbing Supplies',
      'Utilities',
      'Rent',
      'Labor',
      'Marketing',
      'Transportation',
      'Other'
    ],
    electronics: [
      'Inventory',
      'Equipment',
      'Utilities',
      'Rent',
      'Labor',
      'Marketing',
      'Transportation',
      'Other'
    ],
    clothing: [
      'Inventory',
      'Utilities',
      'Rent',
      'Labor',
      'Equipment',
      'Marketing',
      'Transportation',
      'Other'
    ],
    furniture: [
      'Inventory',
      'Utilities',
      'Rent',
      'Labor',
      'Equipment',
      'Marketing',
      'Transportation',
      'Other'
    ],
    bookstore: [
      'Inventory',
      'Utilities',
      'Rent',
      'Labor',
      'Office Supplies',
      'Marketing',
      'Transportation',
      'Other'
    ],
    auto_parts: [
      'Parts',
      'Equipment',
      'Utilities',
      'Rent',
      'Labor',
      'Marketing',
      'Transportation',
      'Other'
    ],
    convenience: [
      'Inventory',
      'Utilities',
      'Rent',
      'Labor',
      'Equipment',
      'Marketing',
      'Transportation',
      'Other'
    ],
    beauty: [
      'Inventory',
      'Utilities',
      'Rent',
      'Labor',
      'Equipment',
      'Marketing',
      'Transportation',
      'Other'
    ],
    sports: [
      'Inventory',
      'Utilities',
      'Rent',
      'Labor',
      'Equipment',
      'Marketing',
      'Transportation',
      'Other'
    ],
    toys: [
      'Inventory',
      'Utilities',
      'Rent',
      'Labor',
      'Equipment',
      'Marketing',
      'Transportation',
      'Other'
    ],
    pet: [
      'Inventory',
      'Utilities',
      'Rent',
      'Labor',
      'Equipment',
      'Marketing',
      'Transportation',
      'Other'
    ],
    stationery: [
      'Inventory',
      'Utilities',
      'Rent',
      'Labor',
      'Office Supplies',
      'Marketing',
      'Transportation',
      'Other'
    ],
    restaurant: [
      'Food & Beverages',
      'Utilities',
      'Rent',
      'Labor',
      'Kitchen Equipment',
      'Marketing',
      'Transportation',
      'Other'
    ],
    other: [
      'Materials',
      'Labor',
      'Equipment',
      'Transportation',
      'Utilities',
      'Marketing',
      'Office Supplies',
      'Maintenance',
      'Other'
    ]
  },
  studio: {
    printing_press: [
      'Paper & Substrates',
      'Inks & Toners',
      'Plates & Screens',
      'Binding & Finishing',
      'Packaging',
      'Labor',
      'Equipment',
      'Utilities',
      'Rent',
      'Marketing',
      'Transportation',
      'Maintenance',
      'Other'
    ],
    mechanic: [
      'Parts',
      'Oil & Fluids',
      'Labor',
      'Equipment',
      'Utilities',
      'Rent',
      'Marketing',
      'Transportation',
      'Diagnostics',
      'Other'
    ],
    barber: [
      'Hair Products',
      'Grooming Supplies',
      'Labor',
      'Equipment',
      'Utilities',
      'Rent',
      'Marketing',
      'Other'
    ],
    salon: [
      'Hair Products',
      'Beauty Products',
      'Nail Supplies',
      'Labor',
      'Equipment',
      'Utilities',
      'Rent',
      'Marketing',
      'Other'
    ],
    default: [
      'Materials',
      'Labor',
      'Equipment',
      'Transportation',
      'Utilities',
      'Marketing',
      'Office Supplies',
      'Maintenance',
      'Other'
    ]
  },
  pharmacy: [
    'Medications',
    'Medical Supplies',
    'Labor',
    'Equipment',
    'Utilities',
    'Rent',
    'Marketing',
    'Transportation',
    'Other'
  ]
};

const LEGACY_TO_STUDIO = ['printing_press', 'mechanic', 'barber', 'salon'];

/**
 * Get expense categories for a tenant based on business type and shop/studio type
 * @param {string} businessType - Tenant businessType (shop, studio, pharmacy, or legacy: printing_press, mechanic, etc.)
 * @param {object} metadata - Tenant metadata (may contain shopType, studioType)
 * @returns {string[]} Array of expense category names
 */
const getExpenseCategories = (businessType, metadata = {}) => {
  const shopType = metadata?.shopType || metadata?.shopTypeKey || 'other';
  const studioType = metadata?.studioType || businessType;

  const resolved = resolveBusinessType(businessType);

  if (resolved === 'pharmacy') {
    return EXPENSE_CATEGORIES.pharmacy || [];
  }

  if (resolved === 'studio') {
    const type = LEGACY_TO_STUDIO.includes(studioType) ? studioType : 'default';
    return EXPENSE_CATEGORIES.studio[type] || EXPENSE_CATEGORIES.studio.default || [];
  }

  if (resolved === 'shop') {
    const normalized = shopType === 'groceries' ? 'supermarket' : shopType;
    return EXPENSE_CATEGORIES.shop[normalized] || EXPENSE_CATEGORIES.shop.other || [];
  }

  return EXPENSE_CATEGORIES.shop.other || [];
};

module.exports = {
  EXPENSE_CATEGORIES,
  getExpenseCategories
};
