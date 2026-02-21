/**
 * Job/Quote/Invoice Item Categories by Studio Type
 *
 * These are the line-item categories for Jobs, Quotes, and Invoices.
 * Studio-only feature (printing_press, mechanic, barber, salon).
 */

const { resolveBusinessType } = require('./businessTypes');

const JOB_ITEM_CATEGORIES = {
  printing_press: [
    { value: 'Black & White Printing', label: 'Black & White Printing', group: 'Services' },
    { value: 'Color Printing', label: 'Color Printing', group: 'Services' },
    { value: 'Large Format Printing', label: 'Large Format Printing', group: 'Services' },
    { value: 'Photocopying', label: 'Photocopying', group: 'Services' },
    { value: 'Business Cards', label: 'Business Cards', group: 'Print Products' },
    { value: 'Brochures', label: 'Brochures', group: 'Print Products' },
    { value: 'Flyers', label: 'Flyers', group: 'Print Products' },
    { value: 'Posters', label: 'Posters', group: 'Print Products' },
    { value: 'Banners', label: 'Banners', group: 'Print Products' },
    { value: 'Booklets', label: 'Booklets', group: 'Print Products' },
    { value: 'Binding', label: 'Binding', group: 'Finishing Services' },
    { value: 'Lamination', label: 'Lamination', group: 'Finishing Services' },
    { value: 'Scanning', label: 'Scanning', group: 'Finishing Services' },
    { value: 'Design Services', label: 'Design Services', group: 'Professional Services' }
  ],
  mechanic: [
    { value: 'Repairs', label: 'Repairs', group: 'Services' },
    { value: 'Oil Change', label: 'Oil Change', group: 'Services' },
    { value: 'Brake Service', label: 'Brake Service', group: 'Services' },
    { value: 'Diagnostics', label: 'Diagnostics', group: 'Services' },
    { value: 'Suspension & Steering', label: 'Suspension & Steering', group: 'Services' },
    { value: 'Electrical', label: 'Electrical', group: 'Services' },
    { value: 'Parts', label: 'Parts', group: 'Parts' },
    { value: 'Other Services', label: 'Other Services', group: 'Other' }
  ],
  barber: [
    { value: 'Haircuts', label: 'Haircuts', group: 'Services' },
    { value: 'Beard Trim', label: 'Beard Trim', group: 'Services' },
    { value: 'Styling', label: 'Styling', group: 'Services' },
    { value: 'Shaves', label: 'Shaves', group: 'Services' },
    { value: 'Coloring', label: 'Coloring', group: 'Services' },
    { value: 'Other Services', label: 'Other Services', group: 'Other' }
  ],
  salon: [
    { value: 'Haircuts', label: 'Haircuts', group: 'Services' },
    { value: 'Coloring', label: 'Coloring', group: 'Services' },
    { value: 'Treatments', label: 'Treatments', group: 'Services' },
    { value: 'Styling', label: 'Styling', group: 'Services' },
    { value: 'Nails', label: 'Nails', group: 'Services' },
    { value: 'Skincare', label: 'Skincare', group: 'Services' },
    { value: 'Other Services', label: 'Other Services', group: 'Other' }
  ],
  default: [
    { value: 'Services', label: 'Services', group: 'Services' },
    { value: 'Materials', label: 'Materials', group: 'Materials' },
    { value: 'Equipment', label: 'Equipment', group: 'Equipment' },
    { value: 'Other', label: 'Other', group: 'Other' }
  ]
};

const LEGACY_TO_STUDIO = ['printing_press', 'mechanic', 'barber', 'salon'];

/**
 * Get job item categories for a tenant based on studio type
 * @param {string} businessType - Tenant businessType (printing_press, mechanic, barber, salon, or studio)
 * @param {object} metadata - Tenant metadata (may contain studioType)
 * @returns {Array} Array of { value, label, group } objects
 */
const getJobItemCategories = (businessType, metadata = {}) => {
  const studioType = metadata?.studioType || businessType;
  const resolved = resolveBusinessType(businessType);

  if (resolved !== 'studio') {
    return JOB_ITEM_CATEGORIES.default || [];
  }

  const type = LEGACY_TO_STUDIO.includes(studioType) ? studioType : 'default';
  return JOB_ITEM_CATEGORIES[type] || JOB_ITEM_CATEGORIES.default || [];
};

module.exports = {
  JOB_ITEM_CATEGORIES,
  getJobItemCategories
};
