/**
 * Demo sample catalog for template gallery / empty-state previews.
 * Not persisted — real OnlineProductListing rows replace these when published.
 * Online Store single-shop surfaces do not use a storefront banner.
 */

export const DEMO_BRAND = {
  displayName: 'Demo Boutique',
  description: 'Sample storefront preview — replace with your branding in ABS.',
  logoUrl: null,
  bannerImageUrl: null,
  primaryColor: '#166534',
  secondaryColor: null,
  tertiaryColor: null,
  contactPhone: '+233 20 000 0000',
  whatsappNumber: '+233200000000',
  contactEmail: 'hello@demo.store',
  currency: 'GHS',
  slug: 'demo-boutique',
  pickupEnabled: true,
  deliveryEnabled: true,
};

export const SAMPLE_PRODUCTS = [
  {
    id: 'sample-1',
    title: 'Everyday Essentials Pack',
    slug: 'everyday-essentials',
    shortDescription: 'Starter kit for your first customers',
    publicPrice: 89,
    compareAtPrice: 120,
    images: ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80'],
  },
  {
    id: 'sample-2',
    title: 'Signature Collection',
    slug: 'signature-collection',
    shortDescription: 'Hero product with premium finish',
    publicPrice: 249,
    compareAtPrice: null,
    images: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80'],
  },
  {
    id: 'sample-3',
    title: 'Weekend Bundle',
    slug: 'weekend-bundle',
    shortDescription: 'Value set for promotions',
    publicPrice: 149,
    compareAtPrice: 180,
    images: ['https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&w=800&q=80'],
  },
  {
    id: 'sample-4',
    title: 'Gift Card',
    slug: 'gift-card',
    shortDescription: 'Flexible amount for any occasion',
    publicPrice: 50,
    compareAtPrice: null,
    images: ['https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=800&q=80'],
  },
  {
    id: 'sample-5',
    title: 'Limited Drop Tee',
    slug: 'limited-drop-tee',
    shortDescription: 'Seasonal highlight SKU',
    publicPrice: 75,
    compareAtPrice: null,
    images: ['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80'],
  },
  {
    id: 'sample-6',
    title: 'Care Kit',
    slug: 'care-kit',
    shortDescription: 'Add-on that lifts average order value',
    publicPrice: 35,
    compareAtPrice: 45,
    images: ['https://images.unsplash.com/photo-1556228578-0d85b1a4d571?auto=format&fit=crop&w=800&q=80'],
  },
];

/**
 * Build a store profile object for template previews.
 * Gallery demos omit merchant colors so template defaults apply.
 * Tenant/personalized previews keep sample products but use merchant chrome.
 *
 * @param {{
 *   templateId?: string,
 *   displayName?: string,
 *   description?: string,
 *   logoUrl?: string,
 *   primaryColor?: string,
 *   secondaryColor?: string,
 *   tertiaryColor?: string,
 *   contactPhone?: string,
 *   whatsappNumber?: string,
 *   contactEmail?: string,
 *   currency?: string,
 *   personalized?: boolean,
 * }} [opts]
 */
export const buildPreviewStore = ({
  templateId = 'classic',
  displayName,
  description,
  logoUrl,
  primaryColor,
  secondaryColor,
  tertiaryColor,
  contactPhone,
  whatsappNumber,
  contactEmail,
  currency,
  personalized = false,
} = {}) => {
  const base = { ...DEMO_BRAND };
  const isPersonalized = personalized || Boolean(displayName || logoUrl);
  return {
    ...base,
    templateId,
    displayName: displayName || base.displayName,
    description: description || (isPersonalized ? '' : base.description),
    logoUrl: logoUrl || (isPersonalized ? null : base.logoUrl),
    bannerImageUrl: null,
    primaryColor: primaryColor || undefined,
    secondaryColor: secondaryColor || undefined,
    tertiaryColor: tertiaryColor || undefined,
    contactPhone: contactPhone || (isPersonalized ? '' : base.contactPhone),
    whatsappNumber: whatsappNumber || (isPersonalized ? '' : base.whatsappNumber),
    contactEmail: contactEmail || (isPersonalized ? '' : base.contactEmail),
    currency: currency || base.currency,
    storeMode: 'shop',
    /** Gallery / tenant iframe demos target SME trial/starter marketing. */
    showAbsPromo: true,
    stats: {
      productCount: SAMPLE_PRODUCTS.length,
      serviceCount: 0,
      categoryCount: 3,
      rating: 4.9,
      reviewsCount: 128,
    },
  };
};
