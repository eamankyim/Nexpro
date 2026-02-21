/**
 * Lead Source options by Business Type
 *
 * Default options vary by business type and shop/studio type.
 */

const { resolveBusinessType } = require('./businessTypes');

const LEAD_SOURCE_OPTIONS = {
  shop: {
    default: [
      { value: 'Online - Website', label: 'Online - Website' },
      { value: 'Referral', label: 'Referral' },
      { value: 'Walk-in', label: 'Walk-in' },
      { value: 'Phone Call', label: 'Phone Call' },
      { value: 'Email', label: 'Email' },
      { value: 'Event/Exhibition', label: 'Event/Exhibition' },
      { value: 'Cold Call', label: 'Cold Call' }
    ],
    restaurant: [
      { value: 'Walk-in', label: 'Walk-in' },
      { value: 'Delivery Platform', label: 'Delivery Platform' },
      { value: 'Social Media', label: 'Social Media' },
      { value: 'Referral', label: 'Referral' }
    ]
  },
  studio: {
    printing_press: [
      { value: 'Online - Website', label: 'Online - Website' },
      { value: 'Referral', label: 'Referral' },
      { value: 'Walk-in', label: 'Walk-in' },
      { value: 'Phone Call', label: 'Phone Call' },
      { value: 'Event/Exhibition', label: 'Event/Exhibition' },
      { value: 'Cold Call', label: 'Cold Call' }
    ],
    mechanic: [
      { value: 'Phone Call', label: 'Phone Call' },
      { value: 'Walk-in', label: 'Walk-in' },
      { value: 'Referral', label: 'Referral' },
      { value: 'Online', label: 'Online' }
    ],
    barber: [
      { value: 'Walk-in', label: 'Walk-in' },
      { value: 'Social Media', label: 'Social Media' },
      { value: 'Referral', label: 'Referral' }
    ],
    salon: [
      { value: 'Walk-in', label: 'Walk-in' },
      { value: 'Social Media', label: 'Social Media' },
      { value: 'Referral', label: 'Referral' }
    ],
    default: [
      { value: 'Online - Website', label: 'Online - Website' },
      { value: 'Referral', label: 'Referral' },
      { value: 'Walk-in', label: 'Walk-in' }
    ]
  },
  pharmacy: [
    { value: 'Doctor Referral', label: 'Doctor Referral' },
    { value: 'Walk-in', label: 'Walk-in' },
    { value: 'Phone Call', label: 'Phone Call' },
    { value: 'Referral', label: 'Referral' }
  ]
};

const LEGACY_TO_STUDIO = ['printing_press', 'mechanic', 'barber', 'salon'];

const getLeadSourceOptions = (businessType, metadata = {}) => {
  const shopType = metadata?.shopType || metadata?.shopTypeKey;
  const studioType = metadata?.studioType || businessType;

  const resolved = resolveBusinessType(businessType);

  if (resolved === 'pharmacy') {
    return LEAD_SOURCE_OPTIONS.pharmacy.map(v => typeof v === 'string' ? { value: v, label: v } : v);
  }

  if (resolved === 'studio') {
    const type = LEGACY_TO_STUDIO.includes(studioType) ? studioType : 'default';
    const opts = LEAD_SOURCE_OPTIONS.studio[type] || LEAD_SOURCE_OPTIONS.studio.default;
    return opts.map(v => typeof v === 'string' ? { value: v, label: v } : v);
  }

  if (resolved === 'shop') {
    const type = shopType === 'restaurant' ? 'restaurant' : 'default';
    const opts = LEAD_SOURCE_OPTIONS.shop[type] || LEAD_SOURCE_OPTIONS.shop.default;
    return opts.map(v => typeof v === 'string' ? { value: v, label: v } : v);
  }

  return LEAD_SOURCE_OPTIONS.shop.default;
};

module.exports = {
  LEAD_SOURCE_OPTIONS,
  getLeadSourceOptions
};
