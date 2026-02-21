/**
 * Customer Source / "How Did You Hear About Us" options by Business Type
 *
 * Default options vary by business type and shop/studio type.
 */

const { resolveBusinessType } = require('./businessTypes');

const CUSTOMER_SOURCE_OPTIONS = {
  shop: {
    default: [
      { value: 'Facebook', label: 'Facebook' },
      { value: 'Instagram', label: 'Instagram' },
      { value: 'Google Search', label: 'Google Search' },
      { value: 'Website', label: 'Website' },
      { value: 'Signboard', label: 'Signboard' },
      { value: 'Walk-in', label: 'Walk-in' },
      { value: 'Referral', label: 'Referral (Word of Mouth)' },
      { value: 'Existing Customer', label: 'Existing Customer' },
      { value: 'Market Outreach', label: 'Market Outreach' },
      { value: 'Flyer/Brochure', label: 'Flyer/Brochure' },
      { value: 'Online Ad', label: 'Online Ad' }
    ],
    restaurant: [
      { value: 'Walk-in', label: 'Walk-in' },
      { value: 'Delivery App', label: 'Delivery App' },
      { value: 'Social Media', label: 'Social Media' },
      { value: 'Google Search', label: 'Google Search' },
      { value: 'Referral', label: 'Referral' },
      { value: 'Signboard', label: 'Signboard' }
    ]
  },
  studio: {
    printing_press: [
      { value: 'Facebook', label: 'Facebook' },
      { value: 'Instagram', label: 'Instagram' },
      { value: 'Google Search', label: 'Google Search' },
      { value: 'Website', label: 'Website' },
      { value: 'Signboard', label: 'Signboard' },
      { value: 'Walk-in', label: 'Walk-in' },
      { value: 'Referral', label: 'Referral (Word of Mouth)' },
      { value: 'Existing Customer', label: 'Existing Customer' },
      { value: 'Flyer/Brochure', label: 'Flyer/Brochure' },
      { value: 'Event/Trade Show', label: 'Event/Trade Show' }
    ],
    mechanic: [
      { value: 'Breakdown', label: 'Breakdown' },
      { value: 'Routine Service', label: 'Routine Service' },
      { value: 'Referral', label: 'Referral' },
      { value: 'Walk-in', label: 'Walk-in' },
      { value: 'Google Search', label: 'Google Search' },
      { value: 'Social Media', label: 'Social Media' }
    ],
    barber: [
      { value: 'Walk-in', label: 'Walk-in' },
      { value: 'Social Media', label: 'Social Media' },
      { value: 'Referral', label: 'Referral' },
      { value: 'Instagram', label: 'Instagram' }
    ],
    salon: [
      { value: 'Walk-in', label: 'Walk-in' },
      { value: 'Social Media', label: 'Social Media' },
      { value: 'Referral', label: 'Referral' },
      { value: 'Instagram', label: 'Instagram' }
    ],
    default: [
      { value: 'Walk-in', label: 'Walk-in' },
      { value: 'Referral', label: 'Referral' },
      { value: 'Website', label: 'Website' },
      { value: 'Social Media', label: 'Social Media' }
    ]
  },
  pharmacy: [
    { value: 'Prescription', label: 'Prescription' },
    { value: 'Doctor Referral', label: 'Doctor Referral' },
    { value: 'Walk-in', label: 'Walk-in' },
    { value: 'Referral', label: 'Referral' },
    { value: 'Google Search', label: 'Google Search' }
  ]
};

const LEGACY_TO_STUDIO = ['printing_press', 'mechanic', 'barber', 'salon'];

const getCustomerSourceOptions = (businessType, metadata = {}) => {
  const shopType = metadata?.shopType || metadata?.shopTypeKey;
  const studioType = metadata?.studioType || businessType;

  const resolved = resolveBusinessType(businessType);

  if (resolved === 'pharmacy') {
    return CUSTOMER_SOURCE_OPTIONS.pharmacy.map(v => typeof v === 'string' ? { value: v, label: v } : v);
  }

  if (resolved === 'studio') {
    const type = LEGACY_TO_STUDIO.includes(studioType) ? studioType : 'default';
    const opts = CUSTOMER_SOURCE_OPTIONS.studio[type] || CUSTOMER_SOURCE_OPTIONS.studio.default;
    return opts.map(v => typeof v === 'string' ? { value: v, label: v } : v);
  }

  if (resolved === 'shop') {
    const type = shopType === 'restaurant' ? 'restaurant' : 'default';
    const opts = CUSTOMER_SOURCE_OPTIONS.shop[type] || CUSTOMER_SOURCE_OPTIONS.shop.default;
    return opts.map(v => typeof v === 'string' ? { value: v, label: v } : v);
  }

  return CUSTOMER_SOURCE_OPTIONS.shop.default;
};

module.exports = {
  CUSTOMER_SOURCE_OPTIONS,
  getCustomerSourceOptions
};
