/**
 * Job/Quote/Invoice Item Categories by Studio Type
 *
 * These are the line-item categories for Jobs, Quotes, and Invoices.
 * Studio-only feature. Keys cover both legacy studioType values and
 * onboarding businessSubType / studio location studioType ids.
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
  software_it_services: [
    { value: 'Discovery & Planning', label: 'Discovery & Planning', group: 'Project Phases' },
    { value: 'UI/UX Design', label: 'UI/UX Design', group: 'Project Phases' },
    { value: 'Website Design and Development', label: 'Website Design and Development', group: 'Development' },
    { value: 'Frontend Development', label: 'Frontend Development', group: 'Development' },
    { value: 'Backend & API Development', label: 'Backend & API Development', group: 'Development' },
    { value: 'Mobile App Development', label: 'Mobile App Development', group: 'Development' },
    { value: 'Testing & QA', label: 'Testing & QA', group: 'Quality Assurance' },
    { value: 'DevOps & Infrastructure', label: 'DevOps & Infrastructure', group: 'Technical Services' },
    { value: 'Website Hosting', label: 'Website Hosting', group: 'Ongoing Services' },
    { value: 'Maintenance & Support', label: 'Maintenance & Support', group: 'Ongoing Services' }
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
  car_wash: [
    { value: 'Exterior Wash', label: 'Exterior Wash', group: 'Services' },
    { value: 'Interior Cleaning', label: 'Interior Cleaning', group: 'Services' },
    { value: 'Full Detailing', label: 'Full Detailing', group: 'Services' },
    { value: 'Wax & Polish', label: 'Wax & Polish', group: 'Services' },
    { value: 'Engine Bay Clean', label: 'Engine Bay Clean', group: 'Services' },
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
  other_professional_services: [
    { value: 'Consulting', label: 'Consulting', group: 'Services' },
    { value: 'Training', label: 'Training', group: 'Services' },
    { value: 'Project Work', label: 'Project Work', group: 'Services' },
    { value: 'Retainer', label: 'Retainer', group: 'Services' },
    { value: 'Other Services', label: 'Other Services', group: 'Other' }
  ],
  default: [
    { value: 'Services', label: 'Services', group: 'Services' },
    { value: 'Materials', label: 'Materials', group: 'Materials' },
    { value: 'Equipment', label: 'Equipment', group: 'Equipment' },
    { value: 'Other', label: 'Other', group: 'Other' }
  ]
};

/**
 * Map studio location / businessSubType ids to JOB_ITEM_CATEGORIES keys.
 * Studio locations store onboarding option ids (e.g. barber_shop, software_it_services).
 */
const STUDIO_TYPE_TO_CATEGORY_KEY = {
  printing_press: 'printing_press',
  software_it_services: 'software_it_services',
  other_professional_services: 'other_professional_services',
  barber_shop: 'barber',
  barber: 'barber',
  hair_salon: 'salon',
  salon: 'salon',
  spa_nail_bar: 'salon',
  mechanic_workshop: 'mechanic',
  mechanic: 'mechanic',
  car_wash: 'car_wash',
};

/** Map subtype → legacy material type key used by getMaterialTypesForStudioType */
const STUDIO_TYPE_TO_MATERIAL_KEY = {
  printing_press: 'printing_press',
  software_it_services: 'printing_press',
  other_professional_services: 'printing_press',
  barber_shop: 'barber',
  barber: 'barber',
  hair_salon: 'salon',
  salon: 'salon',
  spa_nail_bar: 'salon',
  mechanic_workshop: 'mechanic',
  mechanic: 'mechanic',
  car_wash: 'mechanic',
};

/**
 * Resolve the effective studio subtype from tenant + metadata.
 * Prefers location studioType, then metadata.studioType / businessSubType, then legacy businessType.
 * @param {string} businessType
 * @param {object} metadata
 * @returns {string|null}
 */
const resolveStudioSubtype = (businessType, metadata = {}) => {
  const candidates = [
    metadata?.studioType,
    metadata?.businessSubType,
    businessType,
  ].filter(Boolean);
  return candidates.find((value) => STUDIO_TYPE_TO_CATEGORY_KEY[value]) || candidates[0] || null;
};

/**
 * @param {string} businessType
 * @param {object} metadata
 * @returns {string} Key into JOB_ITEM_CATEGORIES
 */
const resolveCategoryCatalogKey = (businessType, metadata = {}) => {
  const subtype = resolveStudioSubtype(businessType, metadata);
  if (!subtype) return 'default';
  return STUDIO_TYPE_TO_CATEGORY_KEY[subtype] || 'default';
};

/**
 * Get job item categories for a tenant based on studio type
 * @param {string} businessType - Tenant businessType (printing_press, mechanic, barber, salon, or studio)
 * @param {object} metadata - Tenant metadata (may contain studioType / businessSubType)
 * @returns {Array} Array of { value, label, group } objects
 */
const getJobItemCategories = (businessType, metadata = {}) => {
  const resolved = resolveBusinessType(businessType);

  if (resolved !== 'studio') {
    return JOB_ITEM_CATEGORIES.default || [];
  }

  const catalogKey = resolveCategoryCatalogKey(businessType, metadata);
  return JOB_ITEM_CATEGORIES[catalogKey] || JOB_ITEM_CATEGORIES.default || [];
};

/**
 * Resolve material-types studio key for the active branch subtype.
 * @param {string} businessType
 * @param {object} metadata
 * @returns {string}
 */
const resolveMaterialStudioType = (businessType, metadata = {}) => {
  const subtype = resolveStudioSubtype(businessType, metadata);
  if (!subtype) return 'printing_press';
  return STUDIO_TYPE_TO_MATERIAL_KEY[subtype] || 'printing_press';
};

module.exports = {
  JOB_ITEM_CATEGORIES,
  STUDIO_TYPE_TO_CATEGORY_KEY,
  getJobItemCategories,
  resolveCategoryCatalogKey,
  resolveMaterialStudioType,
};
