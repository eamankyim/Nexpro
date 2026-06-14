import { resolveImageUrl } from './fileUtils';

export const CATEGORY_IMAGE_URLS = {
  beauty: '/category-beauty-cream.png',
  electronics: '/category-electronics-tv.png',
  fashion: '/category-fashion-bag.png',
  groceries: '/category-groceries-cart.png',
  health: '/category-health-medicine.png',
  home: '/category-home-living-room.png',
};

export const DEFAULT_MARKETPLACE_CATEGORIES = [
  { id: 'fashion', slug: 'fashion', name: 'Fashion', count: 0, imageUrl: CATEGORY_IMAGE_URLS.fashion },
  { id: 'electronics', slug: 'electronics', name: 'Electronics', count: 0, imageUrl: CATEGORY_IMAGE_URLS.electronics },
  { id: 'beauty', slug: 'beauty', name: 'Beauty', count: 0, imageUrl: CATEGORY_IMAGE_URLS.beauty },
  { id: 'groceries', slug: 'groceries', name: 'Groceries', count: 0, imageUrl: CATEGORY_IMAGE_URLS.groceries },
  { id: 'home', slug: 'home', name: 'Home & Living', count: 0, imageUrl: CATEGORY_IMAGE_URLS.home },
  { id: 'health', slug: 'health', name: 'Health', count: 0, imageUrl: CATEGORY_IMAGE_URLS.health },
];

const CATEGORY_MATCHERS = [
  {
    key: 'beauty',
    keywords: ['beauty', 'cosmetic', 'cosmetics', 'personal care', 'skincare', 'skin care', 'hair care', 'grooming', 'fragrance', 'makeup'],
  },
  {
    key: 'electronics',
    keywords: ['electronics', 'electronic', 'phone', 'phones', 'computer', 'computers', 'laptop', 'laptops', 'gadget', 'gadgets', 'tv', 'television'],
  },
  {
    key: 'fashion',
    keywords: ['fashion', 'clothing', 'clothes', 'apparel', 'wear', 'shoe', 'shoes', 'bag', 'bags', 'accessory', 'accessories'],
  },
  {
    key: 'groceries',
    keywords: ['groceries', 'grocery', 'food', 'foods', 'drink', 'drinks', 'beverage', 'beverages', 'pantry', 'supermarket'],
  },
  {
    key: 'health',
    keywords: ['health', 'healthcare', 'pharmacy', 'medicine', 'medical', 'pharma', 'wellness', 'supplement', 'supplements'],
  },
  {
    key: 'home',
    keywords: ['home', 'living', 'furniture', 'decor', 'household', 'kitchen', 'appliance', 'appliances'],
  },
];

const CATEGORY_IMAGE_FIELDS = [
  'imageUrl',
  'image',
  'thumbnailUrl',
  'thumbnail',
  'coverImageUrl',
  'coverImage',
  'iconUrl',
  'icon',
];

const isDefaultCategoryAsset = (value) => (
  typeof value === 'string' && Object.values(CATEGORY_IMAGE_URLS).includes(value.trim())
);

export const normalizeCategoryName = (value = '') => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const getCategoryName = (category) => {
  if (typeof category === 'string') return category;
  return category?.name || category?.title || category?.label || category?.slug || category?.id || '';
};

const getCategoryMergeKeys = (category) => {
  if (typeof category === 'string') return [normalizeCategoryName(category)].filter(Boolean);
  return [
    category?.name,
    category?.title,
    category?.label,
    category?.slug,
    category?.id,
  ].map(normalizeCategoryName).filter(Boolean);
};

const getCategoryCount = (category) => {
  const count = Number.parseInt(category?.count ?? category?.productCount ?? 0, 10);
  return Number.isNaN(count) ? 0 : count;
};

const getExplicitCategoryImageUrl = (category) => {
  if (!category || typeof category !== 'object') return '';
  const rawImage = CATEGORY_IMAGE_FIELDS
    .map((field) => category[field])
    .find((value) => {
      if (typeof value === 'string') return value.trim();
      return value && typeof value === 'object';
    });
  if (isDefaultCategoryAsset(rawImage)) return rawImage.trim();
  return rawImage ? resolveImageUrl(rawImage) : '';
};

export const getDefaultCategoryImageUrl = (categoryName = '') => {
  const normalizedName = normalizeCategoryName(categoryName);
  if (!normalizedName) return '';

  const directKey = Object.keys(CATEGORY_IMAGE_URLS).find((key) => normalizedName === key);
  if (directKey) return CATEGORY_IMAGE_URLS[directKey];

  const match = CATEGORY_MATCHERS.find(({ keywords }) => (
    keywords.some((keyword) => normalizedName.includes(normalizeCategoryName(keyword)))
  ));
  return match ? CATEGORY_IMAGE_URLS[match.key] : '';
};

/**
 * Resolve a category image from uploaded data first, then shared storefront defaults.
 * @param {object|string|null|undefined} category - Category API object or category name.
 * @returns {string} Image URL or an empty string when the caller should render its generic fallback.
 */
export const getCategoryImageUrl = (category) => {
  if (typeof category === 'string') return getDefaultCategoryImageUrl(category);
  const explicitImageUrl = getExplicitCategoryImageUrl(category);
  if (explicitImageUrl) return explicitImageUrl;
  return getDefaultCategoryImageUrl(category?.name || category?.title || category?.label || '');
};

export const withDefaultCategoryImages = (categories = DEFAULT_MARKETPLACE_CATEGORIES) => (
  categories.map((category) => ({
    ...category,
    imageUrl: getCategoryImageUrl(category),
  }))
);

/**
 * Keep system categories visible while adding API/seller categories and preserving counts.
 * Category name, slug, or id matches update the default entry; unique seller categories are appended.
 * @param {Array<object|string>} sellerCategories
 * @param {Array<object>} defaultCategories
 * @returns {Array<object>}
 */
export const mergeWithDefaultCategories = (
  sellerCategories = [],
  defaultCategories = DEFAULT_MARKETPLACE_CATEGORIES
) => {
  const merged = new Map();
  const aliasToKey = new Map();

  const rememberCategoryAliases = (category, key) => {
    getCategoryMergeKeys(category).forEach((alias) => aliasToKey.set(alias, key));
  };

  defaultCategories.forEach((category) => {
    const name = getCategoryName(category);
    const key = normalizeCategoryName(category.slug || category.id || name);
    if (!key) return;
    merged.set(key, {
      ...category,
      count: getCategoryCount(category),
      imageUrl: getCategoryImageUrl(category),
      isDefaultCategory: true,
    });
    rememberCategoryAliases(category, key);
  });

  sellerCategories.forEach((category) => {
    const name = getCategoryName(category);
    const mergeKeys = getCategoryMergeKeys(category);
    const key = mergeKeys.map((alias) => aliasToKey.get(alias)).find(Boolean) || mergeKeys[0];
    if (!key) return;
    const existing = merged.get(key);
    const nextCategory = {
      ...(typeof category === 'string' ? { name } : category),
      name,
      count: getCategoryCount(category),
      imageUrl: getCategoryImageUrl(category),
      isDefaultCategory: Boolean(existing?.isDefaultCategory),
    };

    merged.set(key, existing ? {
      ...existing,
      ...nextCategory,
      id: existing.id || nextCategory.id || key,
      name: existing.name || nextCategory.name,
      count: getCategoryCount(existing) + nextCategory.count,
      imageUrl: existing.isDefaultCategory ? existing.imageUrl : nextCategory.imageUrl || existing.imageUrl,
      isDefaultCategory: existing.isDefaultCategory,
    } : nextCategory);
    rememberCategoryAliases(merged.get(key), key);
  });

  return Array.from(merged.values());
};
