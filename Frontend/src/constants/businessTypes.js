/**
 * Business type catalog for onboarding.
 *
 * Users pick ONE of these everyday business labels.
 * Internally we map each option to:
 * - coreType: 'shop' | 'printing_press' | 'pharmacy'
 * - optional services: to tune hints/UX later (no hard coupling yet)
 */

export const CORE_BUSINESS_TYPES = {
  SHOP: 'shop',
  STUDIO: 'printing_press',
  PHARMACY: 'pharmacy',
};

export const BUSINESS_GROUPS = {
  RETAIL: 'retail',
  PRINT_PHOTO: 'print_photo',
  BEAUTY: 'beauty',
  AUTO: 'auto',
  FOOD: 'food',
  HEALTH: 'health',
  SERVICES: 'services',
};

/**
 * @typedef {Object} BusinessOption
 * @property {string} id - Stable identifier (stored as businessSubType)
 * @property {string} label - User-facing label
 * @property {string} description - Short helper text
 * @property {string} group - One of BUSINESS_GROUPS
 * @property {'shop'|'printing_press'|'pharmacy'} coreType - Core workflow type
 * @property {string[]} [services] - Optional list of services for future use
 */

/** @type {BusinessOption[]} */
export const BUSINESS_OPTIONS = [
  // Retail / POS focused
  {
    id: 'supermarket',
    label: 'Supermarket / Grocery store',
    description: 'Food, drinks, and household items with shelves and POS.',
    group: BUSINESS_GROUPS.RETAIL,
    coreType: CORE_BUSINESS_TYPES.SHOP,
    services: ['retail', 'fmcg'],
  },
  {
    id: 'provision_store',
    label: 'Provision store / Kiosk',
    description: 'Small corner shop, container, or table-top sales.',
    group: BUSINESS_GROUPS.RETAIL,
    coreType: CORE_BUSINESS_TYPES.SHOP,
    services: ['retail'],
  },
  {
    id: 'hardware_store',
    label: 'Hardware & building materials',
    description: 'Cement, iron rods, paint, tools, and construction items.',
    group: BUSINESS_GROUPS.RETAIL,
    coreType: CORE_BUSINESS_TYPES.SHOP,
    services: ['retail', 'building_materials'],
  },
  {
    id: 'electronics_shop',
    label: 'Electronics & phone shop',
    description: 'Phones, TVs, gadgets, and accessories.',
    group: BUSINESS_GROUPS.RETAIL,
    coreType: CORE_BUSINESS_TYPES.SHOP,
    services: ['retail', 'electronics'],
  },
  {
    id: 'fashion_boutique',
    label: 'Clothing & fashion boutique',
    description: 'Clothes, shoes, and fashion accessories.',
    group: BUSINESS_GROUPS.RETAIL,
    coreType: CORE_BUSINESS_TYPES.SHOP,
    services: ['retail', 'fashion'],
  },
  {
    id: 'cosmetics_shop',
    label: 'Cosmetics & beauty products',
    description: 'Hair, skin care, and beauty products.',
    group: BUSINESS_GROUPS.RETAIL,
    coreType: CORE_BUSINESS_TYPES.SHOP,
    services: ['retail', 'beauty_products'],
  },
  {
    id: 'stationery_bookshop',
    label: 'Bookshop & stationery',
    description: 'Books, school supplies, and office stationery.',
    group: BUSINESS_GROUPS.RETAIL,
    coreType: CORE_BUSINESS_TYPES.SHOP,
    services: ['retail', 'stationery'],
  },

  // Professional services – Print, Photo & Branding (studio-like)
  {
    id: 'printing_press',
    label: 'Print, Photo & Branding',
    description: 'e.g. Printing press, photo studio, signage, large format printing.',
    group: BUSINESS_GROUPS.PRINT_PHOTO,
    coreType: CORE_BUSINESS_TYPES.STUDIO,
    services: ['printing', 'design', 'photo', 'signage', 'large_format'],
  },
  {
    id: 'software_it_services',
    label: 'Software & IT Services',
    description: 'e.g. Software development, IT support, web & app development.',
    group: BUSINESS_GROUPS.PRINT_PHOTO,
    coreType: CORE_BUSINESS_TYPES.STUDIO,
    services: ['software', 'it_services', 'consulting'],
  },
  {
    id: 'other_professional_services',
    label: 'Other professional services',
    description: 'e.g. Consulting, training, clergy and other services not listed above.',
    group: BUSINESS_GROUPS.PRINT_PHOTO,
    coreType: CORE_BUSINESS_TYPES.STUDIO,
    services: ['other_services'],
  },

  // Beauty & Grooming (studio-like)
  {
    id: 'barber_shop',
    label: 'Barbering shop',
    description: 'Haircuts and grooming services.',
    group: BUSINESS_GROUPS.BEAUTY,
    coreType: CORE_BUSINESS_TYPES.STUDIO,
    services: ['haircut', 'grooming'],
  },
  {
    id: 'hair_salon',
    label: 'Hair salon / Beauty salon',
    description: 'Hair styling, braids, and beauty treatments.',
    group: BUSINESS_GROUPS.BEAUTY,
    coreType: CORE_BUSINESS_TYPES.STUDIO,
    services: ['hair_styling', 'beauty'],
  },
  {
    id: 'spa_nail_bar',
    label: 'Spa / Nail bar',
    description: 'Spa, nails, massage, and wellness services.',
    group: BUSINESS_GROUPS.BEAUTY,
    coreType: CORE_BUSINESS_TYPES.STUDIO,
    services: ['spa', 'nails', 'wellness'],
  },

  // Auto & Workshop (studio-like)
  {
    id: 'mechanic_workshop',
    label: 'Mechanic workshop / Auto garage',
    description: 'Vehicle repairs and servicing.',
    group: BUSINESS_GROUPS.AUTO,
    coreType: CORE_BUSINESS_TYPES.STUDIO,
    services: ['auto_repair'],
  },
  {
    id: 'car_wash',
    label: 'Car wash & detailing',
    description: 'Car wash, interior cleaning, and detailing services.',
    group: BUSINESS_GROUPS.AUTO,
    coreType: CORE_BUSINESS_TYPES.STUDIO,
    services: ['car_wash', 'detailing'],
  },

  // Food & Drinks (retail / POS)
  {
    id: 'restaurant',
    label: 'Restaurant / Fast food',
    description: 'Dine-in or takeaway food business.',
    group: BUSINESS_GROUPS.FOOD,
    coreType: CORE_BUSINESS_TYPES.SHOP,
    services: ['food_service', 'retail'],
  },
  {
    id: 'bakery',
    label: 'Bakery / Pastry shop',
    description: 'Bread, pastries, and baked goods.',
    group: BUSINESS_GROUPS.FOOD,
    coreType: CORE_BUSINESS_TYPES.SHOP,
    services: ['bakery', 'retail'],
  },

  // Health / Pharmacy
  {
    id: 'community_pharmacy',
    label: 'Community pharmacy',
    description: 'Retail pharmacy with prescriptions and OTC medicines.',
    group: BUSINESS_GROUPS.HEALTH,
    coreType: CORE_BUSINESS_TYPES.PHARMACY,
    services: ['prescriptions', 'otc_medicines'],
  },
  {
    id: 'clinic_pharmacy',
    label: 'Clinic / hospital pharmacy',
    description: 'Pharmacy inside a clinic or hospital.',
    group: BUSINESS_GROUPS.HEALTH,
    coreType: CORE_BUSINESS_TYPES.PHARMACY,
    services: ['prescriptions'],
  },
];

/**
 * Find a business option by id.
 * @param {string|undefined|null} id
 * @returns {BusinessOption|undefined}
 */
export function findBusinessOptionById(id) {
  if (!id) return undefined;
  return BUSINESS_OPTIONS.find((opt) => opt.id === id);
}

/**
 * Get the core business type for a given business sub-type.
 * Falls back to 'shop' when the sub-type is unknown.
 * @param {string|undefined|null} id
 * @returns {'shop'|'printing_press'|'pharmacy'}
 */
export function getCoreTypeForBusinessSubType(id) {
  const option = findBusinessOptionById(id);
  if (option && option.coreType) return option.coreType;
  return CORE_BUSINESS_TYPES.SHOP;
}

