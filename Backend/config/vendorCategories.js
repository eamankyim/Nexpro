/**
 * Vendor Categories by Business Type and Shop/Studio Type
 *
 * Vendor categories vary by:
 * - businessType: shop, studio, pharmacy
 * - shopType: for shop (supermarket, hardware, electronics, etc.)
 * - studioType: for studio (printing_press, mechanic, barber, salon)
 */

const { resolveBusinessType } = require('./businessTypes');

const VENDOR_CATEGORIES = {
  shop: {
    supermarket: [
      'Produce Supplier',
      'Dairy Supplier',
      'Meat & Seafood Supplier',
      'Beverage Distributor',
      'Bakery Supplier',
      'Frozen Foods Supplier',
      'Canned Goods Supplier',
      'Snacks & Confectionery Supplier',
      'Household Supplies Supplier',
      'Personal Care Supplier',
      'Other'
    ],
    hardware: [
      'Tools Supplier',
      'Building Materials Supplier',
      'Electrical Supplies Supplier',
      'Plumbing Supplies Supplier',
      'Paint & Supplies Supplier',
      'Hardware & Fasteners Supplier',
      'Garden & Outdoor Supplier',
      'Safety Equipment Supplier',
      'Other'
    ],
    electronics: [
      'Mobile Devices Supplier',
      'Computers & Laptops Supplier',
      'Audio Equipment Supplier',
      'TV & Entertainment Supplier',
      'Cameras & Accessories Supplier',
      'Gaming Supplier',
      'Cables & Accessories Supplier',
      'Smart Home Devices Supplier',
      'Other'
    ],
    clothing: [
      "Men's Apparel Supplier",
      "Women's Apparel Supplier",
      "Children's Apparel Supplier",
      'Footwear Supplier',
      'Accessories Supplier',
      'Sportswear Supplier',
      'Other'
    ],
    furniture: [
      'Living Room Furniture Supplier',
      'Bedroom Furniture Supplier',
      'Office Furniture Supplier',
      'Outdoor Furniture Supplier',
      'Decorative Items Supplier',
      'Other'
    ],
    bookstore: [
      'Book Distributor',
      'Stationery Supplier',
      'Magazines & Periodicals Supplier',
      'Other'
    ],
    auto_parts: [
      'Engine Parts Supplier',
      'Brake System Supplier',
      'Suspension & Steering Supplier',
      'Electrical & Lighting Supplier',
      'Filters & Fluids Supplier',
      'Tires & Wheels Supplier',
      'Body Parts Supplier',
      'Other'
    ],
    convenience: [
      'Snacks & Beverages Supplier',
      'Tobacco Supplier',
      'Personal Care Supplier',
      'Household Essentials Supplier',
      'Other'
    ],
    beauty: [
      'Skincare Supplier',
      'Makeup Supplier',
      'Hair Care Supplier',
      'Fragrances Supplier',
      'Nail Care Supplier',
      'Beauty Tools Supplier',
      'Other'
    ],
    sports: [
      'Athletic Apparel Supplier',
      'Footwear Supplier',
      'Sports Equipment Supplier',
      'Fitness Equipment Supplier',
      'Outdoor Gear Supplier',
      'Other'
    ],
    toys: [
      'Toy Distributor',
      'Board Games Supplier',
      'Educational Toys Supplier',
      'Other'
    ],
    pet: [
      'Pet Food Supplier',
      'Pet Toys Supplier',
      'Pet Accessories Supplier',
      'Aquarium Supplies Supplier',
      'Other'
    ],
    stationery: [
      'Writing Instruments Supplier',
      'Paper Products Supplier',
      'Office Supplies Supplier',
      'Art Supplies Supplier',
      'Other'
    ],
    restaurant: [
      'Food Supplier',
      'Beverage Supplier',
      'Produce Supplier',
      'Meat & Seafood Supplier',
      'Dairy Supplier',
      'Kitchen Equipment Supplier',
      'Other'
    ],
    other: [
      'General Supplier',
      'Other'
    ]
  },
  studio: {
    printing_press: [
      'Paper Supplier',
      'Ink Supplier',
      'Equipment Supplier',
      'Printing Equipment',
      'Printing Services',
      'Binding & Finishing',
      'Design Services',
      'Pre-Press Services',
      'Packaging Materials',
      'Specialty Papers',
      'Maintenance & Repair',
      'Shipping & Logistics',
      'Software & Technology',
      'Other'
    ],
    mechanic: [
      'Parts Supplier',
      'Equipment Supplier',
      'Oil & Fluids Supplier',
      'Tools & Equipment Supplier',
      'Tire Supplier',
      'Battery Supplier',
      'Diagnostics Equipment Supplier',
      'Other'
    ],
    barber: [
      'Hair Products Supplier',
      'Equipment Supplier',
      'Grooming Supplies Supplier',
      'Barber Chairs & Furniture Supplier',
      'Other'
    ],
    salon: [
      'Hair Products Supplier',
      'Beauty Products Supplier',
      'Equipment Supplier',
      'Nail Supplies Supplier',
      'Skincare Products Supplier',
      'Salon Furniture Supplier',
      'Other'
    ],
    default: [
      'Materials Supplier',
      'Equipment Supplier',
      'Services',
      'Other'
    ]
  },
  pharmacy: [
    'Pharmaceutical Distributor',
    'OTC Supplier',
    'Medical Device Supplier',
    'Generic Drug Supplier',
    'Specialty Pharmacy',
    'Wholesale Supplier',
    'Other'
  ]
};

const LEGACY_TO_STUDIO = ['printing_press', 'mechanic', 'barber', 'salon'];

/**
 * Get vendor categories for a tenant based on business type and shop/studio type
 * @param {string} businessType - Tenant businessType (shop, studio, pharmacy, or legacy: printing_press, mechanic, etc.)
 * @param {object} metadata - Tenant metadata (may contain shopType, studioType)
 * @returns {string[]} Array of vendor category names
 */
const getVendorCategories = (businessType, metadata = {}) => {
  const shopType = metadata?.shopType || metadata?.shopTypeKey || 'other';
  const studioType = metadata?.studioType || businessType;

  const resolved = resolveBusinessType(businessType);

  if (resolved === 'pharmacy') {
    return VENDOR_CATEGORIES.pharmacy || [];
  }

  if (resolved === 'studio') {
    const type = LEGACY_TO_STUDIO.includes(studioType) ? studioType : 'default';
    return VENDOR_CATEGORIES.studio[type] || VENDOR_CATEGORIES.studio.default || [];
  }

  if (resolved === 'shop') {
    const normalized = shopType === 'groceries' ? 'supermarket' : shopType;
    return VENDOR_CATEGORIES.shop[normalized] || VENDOR_CATEGORIES.shop.other || [];
  }

  return VENDOR_CATEGORIES.shop.other || [];
};

module.exports = {
  VENDOR_CATEGORIES,
  getVendorCategories
};
