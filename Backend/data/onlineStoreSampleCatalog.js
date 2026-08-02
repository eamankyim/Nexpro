/**
 * Platform sample catalog for admin Online Store provisioning.
 * Seeded into tenant Product + OnlineProductListing rows with metadata.isSample.
 * Keep ids stable — they are used for idempotent seeding per tenant.
 */

const ONLINE_STORE_SAMPLE_CATALOG = [
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
 * @returns {typeof ONLINE_STORE_SAMPLE_CATALOG}
 */
const listSampleCatalog = () => ONLINE_STORE_SAMPLE_CATALOG.map((item) => ({ ...item }));

/**
 * @param {string} id
 * @returns {object|null}
 */
const getSampleById = (id) => {
  const key = String(id || '').trim();
  if (!key) return null;
  return ONLINE_STORE_SAMPLE_CATALOG.find((item) => item.id === key) || null;
};

module.exports = {
  ONLINE_STORE_SAMPLE_CATALOG,
  listSampleCatalog,
  getSampleById,
};
