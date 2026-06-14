const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const {
  OnlineStoreSettings,
  OnlineProductListing,
  OnlineServiceListing,
  Tenant,
  Sale,
  SaleItem,
  SaleActivity,
  MarketplaceOrderPayment,
  Customer,
  Lead,
  Job,
  Product,
  ProductCategory,
  ProductVariant,
  Shop,
  Setting,
} = require('../models');
const { baseUploadDir, ensureDirExists } = require('../middleware/upload');
const openaiService = require('../services/openaiService');
const { applyTenantFilter } = require('../utils/tenantUtils');
const { getPagination } = require('../utils/paginationUtils');
const { applyShopReadFilter, attachShopToPayload, assertShopIdAccess } = require('../utils/shopUtils');
const { applyStudioLocationReadFilter, attachStudioLocationToPayload } = require('../utils/studioLocationUtils');
const {
  countPublishedServiceListings,
  getStudioMarketplaceHomeData,
  isStudioTenant,
} = require('./studioStoreController');
const { invalidateSaleListCache } = require('../middleware/cache');
const { validateStorageLimit } = require('../utils/storageLimitHelper');
const {
  getTradeAssuranceSummary,
  listPayoutHistory,
  listTradeAssuranceDisputes,
  listTradeAssurancePayments,
  markDeliveryReleaseWindowForSale,
  refundMarketplaceOrderPayment,
  releaseMarketplaceOrderPayment,
} = require('../services/tradeAssuranceService');
const {
  attachProductReviewSummaries,
  attachServiceReviewSummaries,
  attachStoreReviewSummaries,
  getPublicReviewSummary,
} = require('../services/storefrontReviewService');
const {
  CUSTOMER_CONFIRMED_DELIVERY_ERROR_CODE,
  CUSTOMER_CONFIRMED_DELIVERY_ERROR_MESSAGE,
  fulfillmentStateForOrder,
  hasCustomerConfirmedDelivery,
  paymentStatusForMarketplaceOrder,
} = require('../utils/marketplaceOrderStatus');
const { startHotPathTimer } = require('../utils/performanceLogger');

const DEFAULT_PRIMARY_COLOR = '#166534';
const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;
const HEX_SHORT_COLOR_PATTERN = /^#[0-9A-Fa-f]{3}$/;

const normalizePrimaryColor = (value, fallback = DEFAULT_PRIMARY_COLOR) => {
  const trimmed = String(value || '').trim();
  if (HEX_COLOR_PATTERN.test(trimmed)) return trimmed.toLowerCase();
  if (HEX_SHORT_COLOR_PATTERN.test(trimmed)) {
    const [, r, g, b] = trimmed.match(/^#([0-9A-Fa-f])([0-9A-Fa-f])([0-9A-Fa-f])$/i) || [];
    if (r && g && b) return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return fallback;
};

const DEFAULT_CURRENCY = 'GHS';
const LISTING_STATUSES = new Set(['draft', 'published', 'hidden']);
const INVENTORY_POLICIES = new Set(['track', 'continue', 'deny']);
const ONLINE_STORE_SOURCE = 'online_store';
const ORDER_STATUS_FILTERS = new Set(['pending', 'paid', 'processing', 'ready', 'packed', 'out_for_delivery', 'delivered', 'cancelled']);
const STORE_ORDER_STATUS_ACTIONS = new Set(['processing', 'ready', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled']);
const BANNER_PROMPT_MAX_LENGTH = 500;
const BANNER_HINT_MAX_LENGTH = 180;
const DISALLOWED_BANNER_PROMPT_TERMS = /\b(porn|pornographic|nude|nudity|sexually explicit|gore|blood splatter|weapon|hate symbol|gambling|casino)\b/i;

const firstFilled = (...values) => (
  values
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .find(Boolean) || ''
);

const normalizeSlug = (value, fallback = 'store') => {
  const slug = String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return slug || fallback;
};

const normalizeMoney = (value, fallback = 0) => {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Number(parsed.toFixed(2));
};

const normalizeImages = (value) => {
  const images = Array.isArray(value) ? value : [];
  return [...new Set(images.map((image) => String(image || '').trim()).filter(Boolean))].slice(0, 5);
};

const parseQuantity = (value) => {
  const quantity = Number.parseFloat(value);
  return Number.isFinite(quantity) ? quantity : null;
};

const buildListingAvailability = (listing, variantsByProductId = new Map()) => {
  const plain = typeof listing.get === 'function' ? listing.get({ plain: true }) : listing;
  const product = plain.product || null;
  const selectedVariant = plain.variant?.productId === product?.id ? plain.variant : null;
  const productVariants = variantsByProductId.get(product?.id) || [];
  const selectedVariantMissing = Boolean(plain.productVariantId) && !selectedVariant;
  let quantityOnHand = null;
  let source = 'product';
  let stockAvailable = false;

  if (selectedVariant) {
    quantityOnHand = parseQuantity(selectedVariant.quantityOnHand);
    source = 'variant';
    stockAvailable = product?.trackStock === false
      || selectedVariant.trackStock === false
      || (quantityOnHand !== null && quantityOnHand > 0);
  } else if (selectedVariantMissing) {
    source = 'variant';
  } else if (productVariants.length > 0 || product?.hasVariants) {
    quantityOnHand = productVariants.reduce((total, variant) => {
      const variantQuantity = parseQuantity(variant.quantityOnHand);
      return total + Math.max(variantQuantity || 0, 0);
    }, 0);
    source = 'variants';
    stockAvailable = product?.trackStock === false || productVariants.some((variant) => {
      const variantQuantity = parseQuantity(variant.quantityOnHand);
      return variant.trackStock === false || (variantQuantity !== null && variantQuantity > 0);
    });
  } else {
    quantityOnHand = parseQuantity(product?.quantityOnHand);
    stockAvailable = product?.trackStock === false || (quantityOnHand !== null && quantityOnHand > 0);
  }

  const available = Boolean(product) && !selectedVariantMissing && (plain.inventoryPolicy === 'continue' || stockAvailable);
  return {
    ...plain,
    quantityOnHand,
    available,
    availability: {
      status: available ? 'in_stock' : 'out_of_stock',
      label: available ? 'Available' : 'Out of stock',
      message: available ? 'In stock' : 'Not available right now',
      quantityOnHand,
      source,
    },
  };
};

const marketplaceLimit = (value, fallback = 12, max = 48) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
};

const marketplacePage = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

const publicStoreWhere = (extra = {}) => ({
  enabled: true,
  ...extra,
});

const FOOD_SHOP_TYPES = ['restaurant', 'supermarket', 'convenience'];
const DRINK_CATEGORY_PATTERN = /\b(drink|beverage|juice|water|soda|coffee|tea|smoothie|wine|beer)\b/i;
const GROCERY_CATEGORY_PATTERN = /\b(grocery|groceries|produce|pantry|snack|dairy|meat|seafood|bakery|frozen)\b/i;

const parseShopTypeFilter = (value) => {
  const types = String(value || '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  if (!types.length) return [];
  return [...new Set(types)];
};

const buildPublicStoreInclude = (shopTypes = []) => {
  const shopWhere = { isActive: true };
  if (shopTypes.length) {
    shopWhere.shopType = { [Op.in]: shopTypes };
  }
  return [
    { model: Tenant, as: 'tenant', attributes: ['id', 'name', 'businessType', 'status'], required: true, where: { status: 'active' } },
    {
      model: Shop,
      as: 'shop',
      attributes: ['id', 'name', 'shopType', 'city', 'country', 'logoUrl', 'isActive'],
      required: shopTypes.length > 0,
      where: shopWhere,
    },
  ];
};

const publicStoreInclude = buildPublicStoreInclude();

const parseTimeToMinutes = (value) => {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return (hours * 60) + minutes;
};

const computeIsOpenNow = (openingHours) => {
  if (!openingHours || typeof openingHours !== 'object') return null;
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayKey = dayNames[new Date().getDay()];
  const dayHours = openingHours[dayKey];
  if (!dayHours || typeof dayHours !== 'object') return null;
  if (dayHours.closed === true || dayHours.isClosed === true) return false;
  const openMinutes = parseTimeToMinutes(dayHours.open || dayHours.from);
  const closeMinutes = parseTimeToMinutes(dayHours.close || dayHours.to);
  if (openMinutes === null || closeMinutes === null) return null;
  const now = new Date();
  const currentMinutes = (now.getHours() * 60) + now.getMinutes();
  if (closeMinutes <= openMinutes) {
    return currentMinutes >= openMinutes || currentMinutes < closeMinutes;
  }
  return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
};

const extractFoodMetadata = (store) => {
  const plain = typeof store?.get === 'function' ? store.get({ plain: true }) : store;
  const metadata = plain?.metadata && typeof plain.metadata === 'object' ? plain.metadata : {};
  const cuisineTags = Array.isArray(metadata.cuisineTags)
    ? metadata.cuisineTags.map((tag) => String(tag || '').trim()).filter(Boolean).slice(0, 8)
    : (metadata.cuisine ? [String(metadata.cuisine).trim()] : []);
  const openingHours = metadata.openingHours && typeof metadata.openingHours === 'object'
    ? metadata.openingHours
    : null;
  const parsedPrep = Number.parseInt(metadata.avgPrepMinutes, 10);
  const avgPrepMinutes = Number.isFinite(parsedPrep) && parsedPrep > 0 ? parsedPrep : null;
  return {
    shopType: plain?.shop?.shopType || metadata.shopType || null,
    cuisineTags,
    openingHours,
    avgPrepMinutes,
    isOpenNow: computeIsOpenNow(openingHours),
    deliveryFee: normalizeMoney(plain?.deliveryFee, 0),
    freeDeliveryThreshold: metadata.freeDeliveryThreshold != null
      ? normalizeMoney(metadata.freeDeliveryThreshold)
      : null,
  };
};

const publicListingIncludes = [
  {
    model: Product,
    as: 'product',
    attributes: ['id', 'name', 'quantityOnHand', 'unit', 'hasVariants', 'trackStock', 'imageUrl', 'categoryId'],
    required: true,
    where: { isActive: true },
    include: [
      { model: ProductCategory, as: 'category', attributes: ['id', 'name'], required: false, where: { isActive: true } },
    ],
  },
  {
    model: ProductVariant,
    as: 'variant',
    attributes: ['id', 'productId', 'name', 'quantityOnHand', 'trackStock'],
    required: false,
    where: { isActive: true },
  },
];

const getStoreCategoryLabel = (store, categoryCounts = new Map()) => {
  const plain = typeof store?.get === 'function' ? store.get({ plain: true }) : store;
  const metadata = plain?.metadata && typeof plain.metadata === 'object' ? plain.metadata : {};
  if (metadata.category || metadata.storeCategory || metadata.industry) {
    return metadata.category || metadata.storeCategory || metadata.industry;
  }
  if (plain?.shop?.shopType) return plain.shop.shopType.replace(/_/g, ' ');
  const storeKey = `${plain?.tenantId || ''}:${plain?.shopId || ''}`;
  const topCategory = categoryCounts.get(storeKey)?.[0]?.name;
  if (topCategory) return topCategory;
  return plain?.tenant?.businessType ? plain.tenant.businessType.replace(/_/g, ' ') : 'Online store';
};

const resolvePublicBannerImageUrl = (plain = {}) => {
  const metadata = plain.metadata && typeof plain.metadata === 'object' ? plain.metadata : {};
  return plain.bannerImageUrl
    || metadata.bannerImageUrl
    || metadata.bannerUrl
    || metadata.heroImageUrl
    || metadata.coverImageUrl
    || null;
};

const toPublicStoreCard = (store, { listingCount = 0, categoryCounts = new Map() } = {}) => {
  const plain = typeof store.get === 'function' ? store.get({ plain: true }) : store;
  const foodMeta = extractFoodMetadata(plain);
  return {
    id: plain.id,
    slug: plain.slug,
    displayName: plain.displayName,
    description: plain.description,
    logoUrl: plain.logoUrl || plain.shop?.logoUrl || null,
    bannerImageUrl: resolvePublicBannerImageUrl(plain),
    primaryColor: normalizePrimaryColor(plain.primaryColor),
    currency: plain.currency || DEFAULT_CURRENCY,
    category: getStoreCategoryLabel(plain, categoryCounts),
    city: plain.shop?.city || null,
    country: plain.shop?.country || null,
    deliveryEnabled: plain.deliveryEnabled,
    pickupEnabled: plain.pickupEnabled,
    productCount: listingCount,
    rating: plain.rating || plain.reviewSummary?.rating || null,
    reviewsCount: plain.reviewsCount || plain.reviewSummary?.reviewsCount || 0,
    shopType: foodMeta.shopType,
    cuisineTags: foodMeta.cuisineTags,
    openingHours: foodMeta.openingHours,
    avgPrepMinutes: foodMeta.avgPrepMinutes,
    isOpenNow: foodMeta.isOpenNow,
    deliveryFee: foodMeta.deliveryFee,
    freeDeliveryThreshold: foodMeta.freeDeliveryThreshold,
  };
};

const storeMatchesListing = (store, listing) => {
  const storePlain = typeof store.get === 'function' ? store.get({ plain: true }) : store;
  const listingPlain = typeof listing.get === 'function' ? listing.get({ plain: true }) : listing;
  if (storePlain.tenantId !== listingPlain.tenantId) return false;
  return storePlain.shopId ? storePlain.shopId === listingPlain.shopId : true;
};

const buildStoreListingWhere = (stores) => {
  if (!stores.length) return null;
  return {
    status: 'published',
    [Op.or]: stores.map((store) => ({
      tenantId: store.tenantId,
      ...(store.shopId ? { shopId: store.shopId } : {}),
    })),
  };
};

const getVariantMapForListings = async (listings) => {
  const variantProductIds = [
    ...new Set(
      listings
        .map((listing) => (typeof listing.get === 'function' ? listing.get({ plain: true }) : listing))
        .map((listing) => listing.product)
        .filter((product) => product?.hasVariants)
        .map((product) => product.id)
    ),
  ];
  const variants = variantProductIds.length
    ? await ProductVariant.findAll({
      where: {
        productId: { [Op.in]: variantProductIds },
        isActive: true,
      },
      attributes: ['id', 'productId', 'name', 'quantityOnHand', 'trackStock'],
    })
    : [];
  return variants.reduce((map, variant) => {
    const plainVariant = variant.get({ plain: true });
    const productVariants = map.get(plainVariant.productId) || [];
    productVariants.push(plainVariant);
    map.set(plainVariant.productId, productVariants);
    return map;
  }, new Map());
};

const getAvailableListingsWithVariants = async (listings) => {
  const variantsByProductId = await getVariantMapForListings(listings);
  return {
    variantsByProductId,
    listings: listings.filter((listing) => (
      buildListingAvailability(listing, variantsByProductId).available
    )),
  };
};

const getStoreListingCounts = async (stores) => {
  const where = buildStoreListingWhere(stores);
  if (!where) return new Map();
  const rows = await OnlineProductListing.findAll({
    where,
    attributes: ['tenantId', 'shopId', 'productId', 'productVariantId', 'inventoryPolicy'],
    include: publicListingIncludes,
  });
  const { listings } = await getAvailableListingsWithVariants(rows);
  return listings.reduce((map, row) => {
    const listing = row.get({ plain: true });
    stores.forEach((store) => {
      if (storeMatchesListing(store, listing)) {
        const key = `${store.tenantId}:${store.shopId || ''}`;
        map.set(key, (map.get(key) || 0) + 1);
      }
    });
    return map;
  }, new Map());
};

const getCategoryCountsForStores = async (stores) => {
  const where = buildStoreListingWhere(stores);
  if (!where) return { storeCategories: new Map(), categories: [] };
  const listings = await OnlineProductListing.findAll({
    where,
    attributes: ['tenantId', 'shopId', 'productId', 'productVariantId', 'inventoryPolicy'],
    include: publicListingIncludes,
    order: [['publishedAt', 'DESC']],
    limit: 1000,
  });
  const { listings: availableListings } = await getAvailableListingsWithVariants(listings);
  const categoryTotals = new Map();
  const storeCategories = new Map();

  availableListings.forEach((row) => {
    const listing = row.get({ plain: true });
    const category = listing.product?.category;
    if (!category?.name) return;
    const categoryKey = category.id || category.name;
    const total = categoryTotals.get(categoryKey) || { id: category.id, name: category.name, count: 0 };
    total.count += 1;
    categoryTotals.set(categoryKey, total);

    stores.forEach((store) => {
      if (!storeMatchesListing(store, listing)) return;
      const storeKey = `${store.tenantId}:${store.shopId || ''}`;
      const storeList = storeCategories.get(storeKey) || [];
      const existing = storeList.find((item) => item.name === category.name);
      if (existing) existing.count += 1;
      else storeList.push({ name: category.name, count: 1 });
      storeCategories.set(storeKey, storeList.sort((a, b) => b.count - a.count));
    });
  });

  return {
    storeCategories,
    categories: [...categoryTotals.values()].sort((a, b) => b.count - a.count),
  };
};

const withProductDiscountMeta = (product) => {
  const compareAt = Number.parseFloat(product.compareAtPrice || 0);
  const price = Number.parseFloat(product.publicPrice || 0);
  return {
    ...product,
    onSale: compareAt > price,
    discountPercent: compareAt > price ? Math.round(((compareAt - price) / compareAt) * 100) : null,
  };
};

const toMarketplaceProduct = (listing, stores, variantsByProductId = new Map()) => {
  const availableListing = buildListingAvailability(listing, variantsByProductId);
  const store = stores.find((candidate) => storeMatchesListing(candidate, availableListing));
  const storeCard = store ? toPublicStoreCard(store) : null;
  const product = availableListing.product || {};
  return withProductDiscountMeta({
    id: availableListing.id,
    title: availableListing.title,
    slug: availableListing.slug,
    shortDescription: availableListing.shortDescription,
    description: availableListing.description,
    publicPrice: availableListing.publicPrice,
    compareAtPrice: availableListing.compareAtPrice,
    images: availableListing.images,
    available: availableListing.available,
    availability: availableListing.availability,
    category: product.category ? { id: product.category.id, name: product.category.name } : null,
    store: storeCard,
    rating: availableListing.rating || availableListing.reviewSummary?.rating || null,
    reviewsCount: availableListing.reviewsCount || availableListing.reviewSummary?.reviewsCount || 0,
    reviewSummary: availableListing.reviewSummary || null,
    publishedAt: availableListing.publishedAt,
  });
};

const toPublicStoreProduct = (listing, store, variantsByProductId = new Map(), salesCount = 0) => ({
  ...toMarketplaceProduct(listing, [store], variantsByProductId),
  salesCount,
});

const getPublicStoreReviewSummary = (store, limit = 20) => getPublicReviewSummary({
  reviewType: 'store',
  tenantId: store.tenantId,
  shopId: store.shopId || null,
  limit,
});

const getStoreSalesCounts = async (store, productIds) => {
  if (!productIds.length) return new Map();
  const rows = await SaleItem.findAll({
    where: { productId: { [Op.in]: productIds } },
    attributes: [
      'productId',
      [sequelize.fn('SUM', sequelize.col('quantity')), 'quantitySold'],
    ],
    include: [{
      model: Sale,
      as: 'sale',
      attributes: [],
      required: true,
      where: {
        tenantId: store.tenantId,
        ...(store.shopId ? { shopId: store.shopId } : {}),
        status: { [Op.notIn]: ['cancelled', 'refunded'] },
      },
    }],
    group: ['SaleItem.productId'],
  });

  return rows.reduce((map, row) => {
    const plain = row.get({ plain: true });
    map.set(plain.productId, Number.parseFloat(plain.quantitySold || 0));
    return map;
  }, new Map());
};

const getStoreCategoriesFromListings = (listings) => {
  const categories = new Map();
  listings.forEach((listing) => {
    const plain = typeof listing.get === 'function' ? listing.get({ plain: true }) : listing;
    const category = plain.product?.category;
    if (!category?.name) return;
    const key = category.id || category.name;
    const existing = categories.get(key) || { id: category.id || key, name: category.name, count: 0 };
    existing.count += 1;
    categories.set(key, existing);
  });
  return [...categories.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
};

const toPublicStoreHomeProfile = (store, {
  productCount = 0,
  serviceCount = 0,
  categories = [],
  reviewSummary = {},
} = {}) => {
  const plain = typeof store.get === 'function' ? store.get({ plain: true }) : store;
  const metadata = plain.metadata && typeof plain.metadata === 'object' ? plain.metadata : {};
  const businessType = plain.tenant?.businessType || null;
  const storeMode = isStudioTenant(businessType) || plain.studioLocationId ? 'studio' : 'shop';
  const profile = toPublicStoreCard(plain, {
    listingCount: storeMode === 'studio' ? serviceCount : productCount,
    categoryCounts: new Map([[`${plain.tenantId}:${plain.shopId || ''}`, categories]]),
  });

  return {
    ...profile,
    businessType,
    storeMode,
    contactPhone: plain.contactPhone || null,
    whatsappNumber: plain.whatsappNumber || null,
    contactEmail: plain.contactEmail || null,
    deliveryFee: plain.deliveryFee,
    paymentMethods: metadata.paymentMethods || {},
    deliveryOptions: metadata.deliveryOptions || {},
    promo: metadata.promo || metadata.storePromo || null,
    freeDeliveryThreshold: metadata.freeDeliveryThreshold || null,
    stats: {
      productCount,
      serviceCount,
      categoryCount: categories.length,
      rating: reviewSummary.rating || null,
      reviewsCount: reviewSummary.reviewsCount || 0,
      positiveReviewsPercent: reviewSummary.positiveReviewsPercent || null,
    },
  };
};

const buildStoreServiceListingWhere = (store) => {
  if (!store?.tenantId) return null;
  return {
    tenantId: store.tenantId,
    status: 'published',
    ...(store.studioLocationId ? { studioLocationId: store.studioLocationId } : {}),
  };
};

const toPublicStoreService = (listing, store) => {
  const plain = typeof listing.get === 'function' ? listing.get({ plain: true }) : listing;
  const storePlain = typeof store.get === 'function' ? store.get({ plain: true }) : store;

  return {
    id: plain.id,
    title: plain.title,
    slug: plain.slug,
    shortDescription: plain.shortDescription,
    description: plain.description,
    category: plain.category,
    ctaType: plain.ctaType,
    priceType: plain.priceType,
    startingPrice: plain.startingPrice,
    compareAtPrice: plain.compareAtPrice,
    durationMinutes: plain.durationMinutes,
    turnaroundLabel: plain.turnaroundLabel,
    images: plain.images,
    pickupEnabled: plain.pickupEnabled,
    deliveryEnabled: plain.deliveryEnabled,
    rating: plain.rating || plain.reviewSummary?.rating || null,
    reviewsCount: plain.reviewsCount || plain.reviewSummary?.reviewsCount || 0,
    reviewSummary: plain.reviewSummary || null,
    publishedAt: plain.publishedAt,
    studio: {
      id: storePlain.id,
      slug: storePlain.slug,
      displayName: storePlain.displayName,
      logoUrl: storePlain.logoUrl,
      bannerImageUrl: storePlain.bannerImageUrl,
      primaryColor: storePlain.primaryColor,
      currency: storePlain.currency,
    },
  };
};

const getServiceCategoriesFromServices = (services = []) => {
  const counts = services.reduce((map, service) => {
    if (!service.category) return map;
    map.set(service.category, (map.get(service.category) || 0) + 1);
    return map;
  }, new Map());

  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
};

const compactInput = (value, maxLength) => String(value || '').trim().slice(0, maxLength);

const writeGeneratedBannerSvg = async ({ tenantId, svg }) => {
  const buffer = Buffer.from(svg, 'utf8');
  const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

  if (isServerless) {
    return `data:image/svg+xml;base64,${buffer.toString('base64')}`;
  }

  await validateStorageLimit(tenantId, buffer.length, true);
  const subDir = path.join('store-listings', tenantId);
  const uploadPath = path.join(baseUploadDir, subDir);
  ensureDirExists(uploadPath);
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-store-banner.svg`;
  fs.writeFileSync(path.join(uploadPath, filename), buffer);
  return `/uploads/store-listings/${tenantId}/${filename}`;
};

const getLatestGeneratedBannerUrl = (tenantId) => {
  if (!tenantId) return null;

  const uploadPath = path.join(baseUploadDir, 'store-listings', tenantId);
  if (!fs.existsSync(uploadPath)) return null;

  const latest = fs
    .readdirSync(uploadPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /store-banner\.svg$/i.test(entry.name))
    .map((entry) => {
      const filePath = path.join(uploadPath, entry.name);
      return { name: entry.name, mtimeMs: fs.statSync(filePath).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0];

  return latest ? `/uploads/store-listings/${tenantId}/${latest.name}` : null;
};

const storeWhereForRequest = (req, extra = {}) => {
  const query = req.query || {};
  let where = applyTenantFilter(req.tenantId, extra);
  if (req.studioLocationScoped) {
    where = applyStudioLocationReadFilter(req, where);
  } else if (req.shopScoped) {
    where = applyShopReadFilter(req, where);
  } else if (query.studioLocationId) {
    where.studioLocationId = query.studioLocationId;
  } else if (query.shopId) {
    where.shopId = query.shopId;
  }
  return where;
};

/** Tenant/shop scope for online storefront orders (ignore stale dashboard shopId on non-shop tenants). */
const onlineOrderWhereForRequest = (req, extra = {}) => {
  let where = applyTenantFilter(req.tenantId, extra);
  if (req.shopScoped) {
    where = applyShopReadFilter(req, where);
  }
  return where;
};

const addAndCondition = (where, condition) => {
  where[Op.and] = Array.isArray(where[Op.and])
    ? [...where[Op.and], condition]
    : (where[Op.and] ? [where[Op.and], condition] : [condition]);
  return where;
};

const saleMetadataJsonKey = (key) => sequelize.literal(`"Sale"."metadata"->>'${key}'`);

const onlineOrderSourceCondition = () => sequelize.where(saleMetadataJsonKey('source'), ONLINE_STORE_SOURCE);

const applyOnlineOrderStatusFilter = (where, status) => {
  if (!status || status === 'all' || !ORDER_STATUS_FILTERS.has(status)) return where;

  if (status === 'pending') {
    where.status = { [Op.notIn]: ['cancelled', 'refunded'] };
    addAndCondition(where, {
      [Op.or]: [
        { orderStatus: null },
        { orderStatus: 'received' },
      ],
    });
    return where;
  }
  if (status === 'paid') {
    where.status = 'completed';
    return where;
  }
  if (status === 'ready' || status === 'packed') {
    where.status = { [Op.notIn]: ['cancelled', 'refunded'] };
    addAndCondition(where, {
      [Op.or]: [
        { deliveryStatus: 'ready_for_delivery' },
        { orderStatus: 'ready' },
      ],
    });
    return where;
  }
  if (status === 'cancelled') {
    where.status = { [Op.in]: ['cancelled', 'refunded'] };
    return where;
  }
  if (status === 'out_for_delivery') {
    where.deliveryStatus = 'out_for_delivery';
    where.status = { [Op.notIn]: ['cancelled', 'refunded'] };
    return where;
  }
  if (status === 'delivered') {
    where.status = { [Op.notIn]: ['cancelled', 'refunded'] };
    addAndCondition(where, {
      [Op.or]: [
        { deliveryStatus: 'delivered' },
        { orderStatus: 'completed' },
      ],
    });
    return where;
  }

  where.status = { [Op.notIn]: ['cancelled', 'refunded'] };
  addAndCondition(where, {
    orderStatus: { [Op.in]: ['preparing', 'processing'] },
  });
  return where;
};

const buildOnlineOrderWhere = (req, { includeStatus = true } = {}) => {
  const where = onlineOrderWhereForRequest(req);
  addAndCondition(where, onlineOrderSourceCondition());

  if (includeStatus) {
    applyOnlineOrderStatusFilter(where, req.query.status);
  }

  const { startDate, endDate, search } = req.query || {};
  if (startDate || endDate) {
    const start = startDate ? new Date(startDate) : new Date(0);
    const end = endDate ? new Date(endDate) : new Date();
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    where.createdAt = { [Op.between]: [start, end] };
  }

  const term = String(search || '').trim();
  if (term) {
    addAndCondition(where, {
      [Op.or]: [
        { saleNumber: { [Op.iLike]: `%${term}%` } },
        { '$customer.name$': { [Op.iLike]: `%${term}%` } },
        { '$customer.phone$': { [Op.iLike]: `%${term}%` } },
      ],
    });
  }

  return where;
};

const storeOrderInclude = [
  { model: Shop, as: 'shop', attributes: ['id', 'name'], required: false },
  { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone', 'email'], required: false },
  { model: MarketplaceOrderPayment, as: 'marketplacePayment', required: false },
  {
    model: SaleItem,
    as: 'items',
    attributes: ['id', 'productId', 'productVariantId', 'name', 'quantity', 'unitPrice', 'total', 'metadata'],
    required: false,
    include: [
      { model: Product, as: 'product', attributes: ['id', 'name', 'imageUrl'], required: false },
      { model: ProductVariant, as: 'variant', attributes: ['id', 'name', 'sku'], required: false },
    ],
  },
];

const storeOrderDetailInclude = [
  ...storeOrderInclude,
  {
    model: SaleActivity,
    as: 'activities',
    attributes: ['id', 'type', 'subject', 'notes', 'nextStep', 'followUpDate', 'createdBy', 'metadata', 'createdAt'],
    required: false,
    separate: true,
    limit: 50,
    order: [['createdAt', 'DESC']],
  },
];

const countOnlineOrders = (req, extra = {}) => {
  const where = buildOnlineOrderWhere(req, { includeStatus: false });
  Object.assign(where, extra);
  return Sale.count({ where, include: [{ model: Customer, as: 'customer', attributes: [], required: false }] });
};

const getOnlineOrderStats = async (req) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const todayWhere = buildOnlineOrderWhere(req, { includeStatus: false });
  todayWhere.createdAt = { [Op.between]: [todayStart, todayEnd] };
  const revenueWhere = buildOnlineOrderWhere(req, { includeStatus: false });
  revenueWhere.status = { [Op.notIn]: ['cancelled', 'refunded'] };
  const todayRevenueWhere = buildOnlineOrderWhere(req, { includeStatus: false });
  todayRevenueWhere.createdAt = { [Op.between]: [todayStart, todayEnd] };
  todayRevenueWhere.status = { [Op.notIn]: ['cancelled', 'refunded'] };

  const [
    total,
    pendingPayment,
    paid,
    pendingFulfillment,
    processing,
    ready,
    outForDelivery,
    delivered,
    cancelled,
    totalRevenue,
    todayOrders,
    todayRevenue,
  ] = await Promise.all([
    countOnlineOrders(req),
    countOnlineOrders(req, { status: { [Op.in]: ['pending', 'partially_paid'] } }),
    countOnlineOrders(req, { status: 'completed' }),
    Sale.count({
      where: applyOnlineOrderStatusFilter(buildOnlineOrderWhere(req, { includeStatus: false }), 'pending'),
      include: [{ model: Customer, as: 'customer', attributes: [], required: false }],
    }),
    Sale.count({
      where: applyOnlineOrderStatusFilter(buildOnlineOrderWhere(req, { includeStatus: false }), 'processing'),
      include: [{ model: Customer, as: 'customer', attributes: [], required: false }],
    }),
    Sale.count({
      where: applyOnlineOrderStatusFilter(buildOnlineOrderWhere(req, { includeStatus: false }), 'ready'),
      include: [{ model: Customer, as: 'customer', attributes: [], required: false }],
    }),
    countOnlineOrders(req, { deliveryStatus: 'out_for_delivery', status: { [Op.notIn]: ['cancelled', 'refunded'] } }),
    Sale.count({
      where: applyOnlineOrderStatusFilter(buildOnlineOrderWhere(req, { includeStatus: false }), 'delivered'),
      include: [{ model: Customer, as: 'customer', attributes: [], required: false }],
    }),
    countOnlineOrders(req, { status: { [Op.in]: ['cancelled', 'refunded'] } }),
    Sale.sum('total', {
      where: revenueWhere,
      include: [{ model: Customer, as: 'customer', attributes: [], required: false }],
    }),
    Sale.count({ where: todayWhere, include: [{ model: Customer, as: 'customer', attributes: [], required: false }] }),
    Sale.sum('total', {
      where: todayRevenueWhere,
      include: [{ model: Customer, as: 'customer', attributes: [], required: false }],
    }),
  ]);

  return {
    total: Number(total || 0),
    pendingPayment: Number(pendingPayment || 0),
    paid: Number(paid || 0),
    pendingFulfillment: Number(pendingFulfillment || 0),
    processing: Number(processing || 0),
    ready: Number(ready || 0),
    outForDelivery: Number(outForDelivery || 0),
    delivered: Number(delivered || 0),
    cancelled: Number(cancelled || 0),
    totalRevenue: Number(totalRevenue || 0),
    todayOrders: Number(todayOrders || 0),
    todayRevenue: Number(todayRevenue || 0),
  };
};

const serializeStoreOrderItem = (item) => {
  const plain = typeof item.get === 'function' ? item.get({ plain: true }) : item;
  const metadata = plain.metadata && typeof plain.metadata === 'object' ? plain.metadata : {};
  const imageUrl = metadata.imageUrl || plain.product?.imageUrl || null;

  return {
    ...plain,
    imageUrl,
  };
};

const buildSellerRefundSummary = ({ paymentStatus, payoutReleasedAt, payoutId, grossAmount, refundedAmount }) => {
  const normalizedStatus = String(paymentStatus || '').toLowerCase();
  const gross = Number(grossAmount || 0);
  const refunded = Number(refundedAmount || 0);
  const fundsReleasedToBusiness = normalizedStatus === 'released' && Boolean(payoutReleasedAt || payoutId);

  return {
    fundsReleasedToBusiness,
    canSellerRefund: fundsReleasedToBusiness && refunded < gross,
  };
};

const serializeStoreOrder = (order) => {
  const plain = typeof order.get === 'function' ? order.get({ plain: true }) : order;
  const metadata = plain.metadata && typeof plain.metadata === 'object' ? plain.metadata : {};
  const tradeAssuranceMeta = metadata.tradeAssurance && typeof metadata.tradeAssurance === 'object'
    ? metadata.tradeAssurance
    : {};
  const marketplacePayment = plain.marketplacePayment && typeof plain.marketplacePayment === 'object'
    ? plain.marketplacePayment
    : null;
  const paymentStatus = marketplacePayment?.status || tradeAssuranceMeta.paymentStatus || null;
  const grossAmount = Number(marketplacePayment?.grossAmount ?? tradeAssuranceMeta.grossAmount ?? plain.total ?? 0);
  const feeAmount = Number(marketplacePayment?.feeAmount ?? tradeAssuranceMeta.feeAmount ?? 0);
  const netAmount = Number(marketplacePayment?.netAmount ?? tradeAssuranceMeta.netAmount ?? 0);
  const refundedAmount = Number(marketplacePayment?.refundedAmount ?? tradeAssuranceMeta.refundedAmount ?? 0);
  const payoutId = marketplacePayment?.metadata?.payoutId || tradeAssuranceMeta.payoutId || null;
  const payoutReleasedAt = marketplacePayment?.releasedAt || tradeAssuranceMeta.payoutReleasedAt || null;
  const sellerRefundSummary = buildSellerRefundSummary({
    paymentStatus,
    payoutReleasedAt,
    payoutId,
    grossAmount,
    refundedAmount,
  });

  return {
    ...plain,
    items: Array.isArray(plain.items) ? plain.items.map(serializeStoreOrderItem) : [],
    customer: plain.customer || {},
    shop: plain.shop || {},
    fulfillmentStatus: fulfillmentStateForOrder(plain),
    storeSlug: metadata.storeSlug || null,
    fulfillmentMethod: metadata.fulfillmentMethod || (plain.deliveryRequired ? 'delivery' : 'pickup'),
    deliveryAddress: metadata.deliveryAddress || null,
    deliveryTracking: metadata.deliveryTracking || null,
    paymentStatus: paymentStatusForMarketplaceOrder(plain),
    tradeAssurance: {
      paymentStatus,
      marketplacePaymentId: marketplacePayment?.id || tradeAssuranceMeta.marketplacePaymentId || null,
      grossAmount,
      feeAmount,
      netAmount,
      refundedAmount,
      heldAt: marketplacePayment?.heldAt || tradeAssuranceMeta.heldAt || null,
      payoutHold: tradeAssuranceMeta.payoutHold === true,
      payoutReleaseEligible: tradeAssuranceMeta.payoutReleaseEligible === true,
      payoutReleaseEligibleAt: tradeAssuranceMeta.payoutReleaseEligibleAt || null,
      payoutReleasedAt,
      payoutPaidOutAt: tradeAssuranceMeta.payoutPaidOutAt || null,
      payoutId,
      payoutTransferReference: tradeAssuranceMeta.payoutTransferReference || null,
      autoReleaseHours: tradeAssuranceMeta.autoReleaseHours || null,
      ...sellerRefundSummary,
    },
  };
};

const isStudioStoreRequest = (req) => req && isStudioTenant(req.tenant?.businessType);

const serviceBookingLeadInclude = (req, { required = true } = {}) => {
  const leadWhere = {
    [Op.and]: [
      sequelize.where(
        sequelize.literal('"adminLead"."metadata"->>\'requestType\''),
        'paid_service_booking',
      ),
    ],
  };

  const term = String(req.query?.search || '').trim();
  if (term) {
    leadWhere[Op.or] = [
      { name: { [Op.iLike]: `%${term}%` } },
      { email: { [Op.iLike]: `%${term}%` } },
      { phone: { [Op.iLike]: `%${term}%` } },
    ];
  }

  return {
    model: Lead,
    as: 'adminLead',
    required,
    attributes: ['id', 'name', 'email', 'phone', 'metadata', 'status'],
    where: leadWhere,
  };
};

const applyServiceBookingStatusFilter = (where, status) => {
  if (!status || status === 'all' || !ORDER_STATUS_FILTERS.has(status)) return where;

  if (status === 'pending') {
    where.status = 'new';
    addAndCondition(where, serviceBookingPaymentCondition(['paid', 'success', 'successful', 'service_paid']));
    return where;
  }
  if (status === 'paid') {
    addAndCondition(where, serviceBookingPaymentCondition(['paid', 'success', 'successful', 'service_paid']));
    return where;
  }
  if (status === 'processing') {
    where.status = 'in_progress';
    return where;
  }
  if (status === 'delivered') {
    where.status = 'completed';
    return where;
  }
  if (status === 'cancelled') {
    where.status = 'cancelled';
    return where;
  }

  return where;
};

const serviceBookingWhereForRequest = (req, extra = {}, { includeStatus = true } = {}) => {
  let where = applyTenantFilter(req.tenantId, {
    ...extra,
    adminLeadId: { [Op.ne]: null },
  });
  if (req.studioLocationScoped) {
    where = applyStudioLocationReadFilter(req, where);
  }

  if (includeStatus) {
    applyServiceBookingStatusFilter(where, req.query?.status);
  }

  const { startDate, endDate, search } = req.query || {};
  if (startDate || endDate) {
    const start = startDate ? new Date(startDate) : new Date(0);
    const end = endDate ? new Date(endDate) : new Date();
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    where.createdAt = { [Op.between]: [start, end] };
  }

  const term = String(search || '').trim();
  if (term) {
    addAndCondition(where, {
      [Op.or]: [
        { jobNumber: { [Op.iLike]: `%${term}%` } },
        { title: { [Op.iLike]: `%${term}%` } },
      ],
    });
  }

  return where;
};

const serviceBookingPaymentStatusLiteral = sequelize.literal(`
  COALESCE(
    "Job"."metadata"->>'paymentStatus',
    "Job"."metadata"->'paystack'->>'status',
    "adminLead"."metadata"->>'paymentStatus',
    CASE WHEN "Job"."status" = 'completed' THEN 'paid' ELSE NULL END
  )
`);

const serviceBookingPaymentCondition = (statuses) => sequelize.where(
  serviceBookingPaymentStatusLiteral,
  { [Op.in]: statuses },
);

const countServiceBookings = (req, extra = {}, leadInclude = serviceBookingLeadInclude(req)) => (
  Job.count({
    where: serviceBookingWhereForRequest(req, extra, { includeStatus: false }),
    include: [leadInclude],
    distinct: true,
  })
);

const getServiceBookingStats = async (req) => {
  if (!isStudioStoreRequest(req)) {
    return {
      total: 0,
      pendingPayment: 0,
      paid: 0,
      pendingFulfillment: 0,
      processing: 0,
      ready: 0,
      outForDelivery: 0,
      delivered: 0,
      cancelled: 0,
      totalRevenue: 0,
      todayOrders: 0,
      todayRevenue: 0,
    };
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const paidStatuses = ['paid', 'success', 'successful', 'service_paid'];
  const pendingStatuses = ['awaiting_payment', 'pending', 'pending_payment'];
  const paidRevenueInclude = serviceBookingLeadInclude(req);
  const paidRevenueWhere = serviceBookingWhereForRequest(req, {
    status: { [Op.ne]: 'cancelled' },
  }, { includeStatus: false });
  addAndCondition(paidRevenueWhere, serviceBookingPaymentCondition(paidStatuses));

  const todayRevenueWhere = serviceBookingWhereForRequest(req, {
    status: { [Op.ne]: 'cancelled' },
    createdAt: { [Op.between]: [todayStart, todayEnd] },
  }, { includeStatus: false });
  addAndCondition(todayRevenueWhere, serviceBookingPaymentCondition(paidStatuses));

  const [
    total,
    pendingPayment,
    paid,
    pendingFulfillment,
    processing,
    delivered,
    cancelled,
    totalRevenue,
    todayOrders,
    todayRevenue,
  ] = await Promise.all([
    countServiceBookings(req),
    countServiceBookings(req, { [Op.and]: [serviceBookingPaymentCondition(pendingStatuses)] }),
    countServiceBookings(req, { [Op.and]: [serviceBookingPaymentCondition(paidStatuses)] }),
    countServiceBookings(req, { status: 'new', [Op.and]: [serviceBookingPaymentCondition(paidStatuses)] }),
    countServiceBookings(req, { status: 'in_progress', [Op.and]: [serviceBookingPaymentCondition(paidStatuses)] }),
    countServiceBookings(req, { status: 'completed' }),
    countServiceBookings(req, { status: 'cancelled' }),
    Job.sum('finalPrice', { where: paidRevenueWhere, include: [paidRevenueInclude] }),
    countServiceBookings(req, { createdAt: { [Op.between]: [todayStart, todayEnd] } }),
    Job.sum('finalPrice', { where: todayRevenueWhere, include: [serviceBookingLeadInclude(req)] }),
  ]);

  return {
    total: Number(total || 0),
    pendingPayment: Number(pendingPayment || 0),
    paid: Number(paid || 0),
    pendingFulfillment: Number(pendingFulfillment || 0),
    processing: Number(processing || 0),
    ready: 0,
    outForDelivery: 0,
    delivered: Number(delivered || 0),
    cancelled: Number(cancelled || 0),
    totalRevenue: Number(totalRevenue || 0),
    todayOrders: Number(todayOrders || 0),
    todayRevenue: Number(todayRevenue || 0),
  };
};

const combineOrderStats = (productStats = {}, serviceStats = {}) => ({
  total: Number(productStats.total || 0) + Number(serviceStats.total || 0),
  pendingPayment: Number(productStats.pendingPayment || 0) + Number(serviceStats.pendingPayment || 0),
  paid: Number(productStats.paid || 0) + Number(serviceStats.paid || 0),
  pendingFulfillment: Number(productStats.pendingFulfillment || 0) + Number(serviceStats.pendingFulfillment || 0),
  processing: Number(productStats.processing || 0) + Number(serviceStats.processing || 0),
  ready: Number(productStats.ready || 0) + Number(serviceStats.ready || 0),
  outForDelivery: Number(productStats.outForDelivery || 0) + Number(serviceStats.outForDelivery || 0),
  delivered: Number(productStats.delivered || 0) + Number(serviceStats.delivered || 0),
  cancelled: Number(productStats.cancelled || 0) + Number(serviceStats.cancelled || 0),
  totalRevenue: Number(productStats.totalRevenue || 0) + Number(serviceStats.totalRevenue || 0),
  todayOrders: Number(productStats.todayOrders || 0) + Number(serviceStats.todayOrders || 0),
  todayRevenue: Number(productStats.todayRevenue || 0) + Number(serviceStats.todayRevenue || 0),
});

const serializeServiceBookingOrder = (job) => {
  const plain = typeof job.get === 'function' ? job.get({ plain: true }) : job;
  const lead = plain.adminLead || {};
  const leadMetadata = lead.metadata && typeof lead.metadata === 'object' ? lead.metadata : {};
  const jobMetadata = plain.metadata && typeof plain.metadata === 'object' ? plain.metadata : {};
  const metadata = { ...leadMetadata, ...jobMetadata };
  const payment = metadata.paystack || {};
  const appointment = metadata.appointment || {
    preferredDate: metadata.preferredDate || null,
    preferredTime: metadata.preferredTime || null,
    appointmentAt: metadata.appointmentAt || null,
  };
  const total = Number.parseFloat(plain.finalPrice || plain.quotedPrice || payment.amount || 0);
  const paymentStatus = metadata.paymentStatus || payment.status || (plain.status === 'completed' ? 'paid' : 'pending');
  const fulfillmentStatus = plain.status === 'completed'
    ? 'delivered'
    : plain.status === 'cancelled'
      ? 'cancelled'
      : plain.status === 'in_progress'
        ? 'processing'
        : 'pending';

  return {
    ...plain,
    id: plain.id,
    orderType: 'service',
    saleNumber: plain.jobNumber,
    orderNumber: plain.jobNumber,
    customerName: lead.name || metadata.storefrontCustomerName || metadata.storefrontCustomerEmail || 'Storefront customer',
    customerPhone: lead.phone || null,
    customerEmail: lead.email || metadata.storefrontCustomerEmail || null,
    customer: {
      id: lead.id || null,
      name: lead.name || metadata.storefrontCustomerName || 'Storefront customer',
      phone: lead.phone || null,
      email: lead.email || metadata.storefrontCustomerEmail || null,
    },
    total,
    subtotal: total,
    paymentStatus,
    status: paymentStatus,
    orderStatus: fulfillmentStatus === 'processing' ? 'processing' : (fulfillmentStatus === 'delivered' ? 'completed' : 'received'),
    fulfillmentStatus,
    storeSlug: metadata.studioSlug || null,
    fulfillmentMethod: 'service',
    appointment,
    items: [{
      id: plain.id,
      name: metadata.serviceTitle || plain.title,
      title: metadata.serviceTitle || plain.title,
      quantity: 1,
      unitPrice: total,
      total,
      metadata: {
        serviceListingId: metadata.serviceListingId || null,
        serviceSlug: metadata.serviceSlug || null,
        preferredDate: appointment.preferredDate || null,
        preferredTime: appointment.preferredTime || null,
      },
    }],
    tradeAssurance: {
      paymentStatus,
      grossAmount: total,
      feeAmount: 0,
      netAmount: total,
      refundedAmount: 0,
      heldAt: payment.paidAt || null,
      payoutHold: true,
      fundsReleasedToBusiness: false,
      canSellerRefund: false,
    },
  };
};

const normalizeRequestDateRange = (query = {}) => {
  const { startDate, endDate } = query || {};
  if (!startDate && !endDate) return null;
  const start = startDate ? new Date(startDate) : new Date(0);
  const end = endDate ? new Date(endDate) : new Date();
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const addMixedFeedDateClause = (clauses, alias, replacements, query = {}) => {
  const range = normalizeRequestDateRange(query);
  if (!range) return;
  clauses.push(`${alias}."createdAt" BETWEEN :mixedStartDate AND :mixedEndDate`);
  replacements.mixedStartDate = range.start;
  replacements.mixedEndDate = range.end;
};

const productStatusSqlClause = (status) => {
  if (!status || status === 'all' || !ORDER_STATUS_FILTERS.has(status)) return '';
  if (status === 'pending') {
    return `s."status" NOT IN ('cancelled', 'refunded') AND (s."orderStatus" IS NULL OR s."orderStatus" = 'received')`;
  }
  if (status === 'paid') return `s."status" = 'completed'`;
  if (status === 'ready' || status === 'packed') {
    return `s."status" NOT IN ('cancelled', 'refunded') AND (s."deliveryStatus" = 'ready_for_delivery' OR s."orderStatus" = 'ready')`;
  }
  if (status === 'cancelled') return `s."status" IN ('cancelled', 'refunded')`;
  if (status === 'out_for_delivery') {
    return `s."deliveryStatus" = 'out_for_delivery' AND s."status" NOT IN ('cancelled', 'refunded')`;
  }
  if (status === 'delivered') {
    return `s."status" NOT IN ('cancelled', 'refunded') AND (s."deliveryStatus" = 'delivered' OR s."orderStatus" = 'completed')`;
  }
  return `s."status" NOT IN ('cancelled', 'refunded') AND s."orderStatus" IN ('preparing', 'processing')`;
};

const servicePaymentStatusSql = `COALESCE(
  j."metadata"->>'paymentStatus',
  j."metadata"->'paystack'->>'status',
  l."metadata"->>'paymentStatus',
  CASE WHEN j."status" = 'completed' THEN 'paid' ELSE NULL END
)`;

const serviceStatusSqlClause = (status) => {
  if (!status || status === 'all' || !ORDER_STATUS_FILTERS.has(status)) return '';
  if (status === 'pending') {
    return `j."status" = 'new' AND ${servicePaymentStatusSql} IN ('paid', 'success', 'successful', 'service_paid')`;
  }
  if (status === 'paid') {
    return `${servicePaymentStatusSql} IN ('paid', 'success', 'successful', 'service_paid')`;
  }
  if (status === 'processing') return `j."status" = 'in_progress'`;
  if (status === 'delivered') return `j."status" = 'completed'`;
  if (status === 'cancelled') return `j."status" = 'cancelled'`;
  return '';
};

const buildMixedOrdersFeedSql = (req, { limit, offset }) => {
  const replacements = {
    tenantId: req.tenantId,
    onlineStoreSource: ONLINE_STORE_SOURCE,
    limit,
    offset,
  };
  const productClauses = [
    `s."tenantId" = :tenantId`,
    `s."metadata"->>'source' = :onlineStoreSource`,
  ];
  const serviceClauses = [
    `j."tenantId" = :tenantId`,
    `j."adminLeadId" IS NOT NULL`,
    `l."metadata"->>'requestType' = 'paid_service_booking'`,
  ];

  if (req.shopScoped && req.shopFilterId) {
    productClauses.push(`s."shopId" = :shopFilterId`);
    replacements.shopFilterId = req.shopFilterId;
  }
  if (req.studioLocationScoped && req.studioLocationFilterId) {
    serviceClauses.push(`j."studioLocationId" = :studioLocationFilterId`);
    replacements.studioLocationFilterId = req.studioLocationFilterId;
  }

  const productStatusClause = productStatusSqlClause(req.query?.status);
  if (productStatusClause) productClauses.push(`(${productStatusClause})`);
  const serviceStatusClause = serviceStatusSqlClause(req.query?.status);
  if (serviceStatusClause) serviceClauses.push(`(${serviceStatusClause})`);

  addMixedFeedDateClause(productClauses, 's', replacements, req.query);
  addMixedFeedDateClause(serviceClauses, 'j', replacements, req.query);

  const term = String(req.query?.search || '').trim();
  if (term) {
    replacements.mixedSearch = `%${term}%`;
    productClauses.push(`(
      s."saleNumber" ILIKE :mixedSearch
      OR c."name" ILIKE :mixedSearch
      OR c."phone" ILIKE :mixedSearch
    )`);
    serviceClauses.push(`(
      j."jobNumber" ILIKE :mixedSearch
      OR j."title" ILIKE :mixedSearch
      OR l."name" ILIKE :mixedSearch
      OR l."email" ILIKE :mixedSearch
      OR l."phone" ILIKE :mixedSearch
    )`);
  }

  return {
    sql: `
      WITH mixed_orders AS (
        SELECT 'product' AS "orderType", s."id", s."createdAt" AS "sortAt"
        FROM sales s
        LEFT JOIN customers c ON c."id" = s."customerId"
        WHERE ${productClauses.join(' AND ')}
        UNION ALL
        SELECT 'service' AS "orderType", j."id", j."createdAt" AS "sortAt"
        FROM jobs j
        INNER JOIN leads l ON l."id" = j."adminLeadId"
        WHERE ${serviceClauses.join(' AND ')}
      )
      SELECT "orderType", "id", "sortAt"
      FROM mixed_orders
      ORDER BY "sortAt" DESC NULLS LAST, "id" DESC
      LIMIT :limit OFFSET :offset
    `,
    replacements,
  };
};

const getMixedStoreOrders = async (req, { limit, offset }) => {
  const productWhere = buildOnlineOrderWhere(req);
  const serviceWhere = serviceBookingWhereForRequest(req);
  const { sql, replacements } = buildMixedOrdersFeedSql(req, { limit, offset });

  const [feedRows, productCount, serviceCount, productStats, serviceStats] = await Promise.all([
    sequelize.query(sql, {
      replacements,
      type: sequelize.QueryTypes.SELECT,
    }),
    Sale.count({
      where: productWhere,
      include: [{ model: Customer, as: 'customer', attributes: [], required: false }],
      distinct: true,
    }),
    Job.count({
      where: serviceWhere,
      include: [serviceBookingLeadInclude(req)],
      distinct: true,
    }),
    getOnlineOrderStats(req),
    getServiceBookingStats(req),
  ]);

  const productIds = feedRows.filter((row) => row.orderType === 'product').map((row) => row.id);
  const serviceIds = feedRows.filter((row) => row.orderType === 'service').map((row) => row.id);
  const [productRows, serviceRows] = await Promise.all([
    productIds.length
      ? Sale.findAll({
        where: {
          ...productWhere,
          id: { [Op.in]: productIds },
        },
        attributes: { exclude: ['notes'] },
        include: storeOrderInclude,
      })
      : [],
    serviceIds.length
      ? Job.findAll({
        where: {
          ...serviceWhere,
          id: { [Op.in]: serviceIds },
        },
        include: [serviceBookingLeadInclude(req)],
      })
      : [],
  ]);

  const rowsByKey = new Map([
    ...productRows.map((row) => [`product:${row.id}`, serializeStoreOrder(row)]),
    ...serviceRows.map((row) => [`service:${row.id}`, serializeServiceBookingOrder(row)]),
  ]);
  const rows = feedRows
    .map((row) => rowsByKey.get(`${row.orderType}:${row.id}`))
    .filter(Boolean);

  return {
    count: Number(productCount || 0) + Number(serviceCount || 0),
    stats: combineOrderStats(productStats, serviceStats),
    rows,
  };
};

const getStoreOrderExportRows = (orders) => orders.map((order) => {
  const plain = serializeStoreOrder(order);
  const items = Array.isArray(plain.items) ? plain.items : [];
  const itemSummary = items.map((item) => {
    const quantity = item.quantity || 1;
    const name = item.name || item.product?.name || 'Item';
    return `${quantity} x ${name}`;
  }).join('; ');

  return {
    ...plain,
    itemSummary,
  };
});

const STORE_ORDER_EXPORT_COLUMNS = [
  { key: 'saleNumber', header: 'Order #' },
  { key: 'customer.name', header: 'Customer' },
  { key: 'customer.phone', header: 'Phone' },
  { key: 'shop.name', header: 'Shop' },
  { key: 'createdAt', header: 'Date', type: 'datetime' },
  { key: 'itemSummary', header: 'Items' },
  { key: 'subtotal', header: 'Subtotal', type: 'currency' },
  { key: 'deliveryFee', header: 'Delivery Fee', type: 'currency' },
  { key: 'total', header: 'Total', type: 'currency' },
  { key: 'paymentMethod', header: 'Payment Method' },
  { key: 'status', header: 'Payment Status' },
  { key: 'orderStatus', header: 'Fulfillment Status' },
  { key: 'deliveryStatus', header: 'Delivery Status' },
];

const getTradeAssuranceScope = (req) => ({
  shopId: req.shopScoped ? (req.shopFilterId || null) : null,
  includeLegacyShopNull: Boolean(req.shopScoped && req.shopFilterId),
});

const tradeAssurancePagination = (req, fallbackLimit = 50) => {
  const page = Math.max(Number.parseInt(req.query?.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(req.query?.limit, 10) || fallbackLimit, 1), 100);
  return { page, limit, offset: (page - 1) * limit };
};

const fulfillmentUpdateForAction = (action) => {
  switch (action) {
    case 'processing':
      return { orderStatus: 'preparing', deliveryStatus: null };
    case 'ready':
    case 'packed':
      return { orderStatus: 'ready', deliveryStatus: 'ready_for_delivery' };
    case 'shipped':
    case 'out_for_delivery':
      return { orderStatus: 'ready', deliveryStatus: 'out_for_delivery' };
    case 'delivered':
      return { orderStatus: 'completed', deliveryStatus: 'delivered', deliveredAt: new Date() };
    case 'cancelled':
      return { status: 'cancelled', orderStatus: 'cancelled', deliveryStatus: null };
    default:
      return null;
  }
};

const targetFulfillmentStateForAction = (action) => {
  if (action === 'ready' || action === 'packed') return 'ready';
  if (action === 'shipped' || action === 'out_for_delivery') return 'out_for_delivery';
  return action;
};

const STORE_ORDER_STATUS_TRANSITIONS = {
  pending: ['processing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'],
  paid: ['processing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'],
  processing: ['ready', 'out_for_delivery', 'delivered', 'cancelled'],
  ready: ['out_for_delivery', 'delivered', 'cancelled'],
  out_for_delivery: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

const canTransitionStoreOrder = (order, action) => {
  const currentState = fulfillmentStateForOrder(order);
  const targetState = targetFulfillmentStateForAction(action);
  return (STORE_ORDER_STATUS_TRANSITIONS[currentState] || []).includes(targetState);
};

const appendDeliveryTrackingMetadata = (metadata, action, actorUserId = null, extra = {}) => {
  const nextMetadata = metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? { ...metadata }
    : {};
  const deliveryTracking = nextMetadata.deliveryTracking && typeof nextMetadata.deliveryTracking === 'object'
    ? { ...nextMetadata.deliveryTracking }
    : {};
  const history = Array.isArray(deliveryTracking.history) ? deliveryTracking.history.slice(-19) : [];
  const trackedStatus = action === 'ready' ? 'packed' : action;
  const timestamp = new Date().toISOString();
  nextMetadata.deliveryTracking = {
    ...deliveryTracking,
    status: trackedStatus,
    deliveredAt: trackedStatus === 'delivered' ? timestamp : null,
    history: [
      ...history,
      {
        status: trackedStatus,
        at: timestamp,
        source: 'abs_online_orders',
        actorUserId,
        ...extra,
      },
    ],
  };
  if (action === 'cancelled' && extra.reason) {
    nextMetadata.cancellation = {
      reason: extra.reason,
      cancelledAt: timestamp,
      cancelledBy: actorUserId,
      source: 'seller',
    };
  }
  return nextMetadata;
};

const restoreSaleItemStock = async (saleId, transaction) => {
  const items = await SaleItem.findAll({ where: { saleId }, transaction });
  for (const item of items) {
    const product = item.productId ? await Product.findByPk(item.productId, { transaction }) : null;
    if (product && product.trackStock !== false) {
      const quantityOnHand = Number.parseFloat(product.quantityOnHand || 0) + Number.parseFloat(item.quantity || 0);
      await product.update({ quantityOnHand }, { transaction });
    }

    if (item.productVariantId) {
      const variant = await ProductVariant.findByPk(item.productVariantId, { transaction });
      const parent = product || (item.productId ? await Product.findByPk(item.productId, { transaction }) : null);
      if (variant && parent?.trackStock !== false && variant.trackStock !== false) {
        const quantityOnHand = Number.parseFloat(variant.quantityOnHand || 0) + Number.parseFloat(item.quantity || 0);
        await variant.update({ quantityOnHand }, { transaction });
      }
    }
  }
};

const getCurrentStoreSettings = async (req) => {
  const where = storeWhereForRequest(req);
  return OnlineStoreSettings.findOne({
    where,
    order: [['createdAt', 'ASC']],
  });
};

const resolveStoreLogoFallback = async (req) => {
  const organizationSetting = await Setting.findOne({
    where: { tenantId: req.tenantId, key: 'organization' },
    attributes: ['value'],
  });
  const organization = organizationSetting?.value || {};
  const tenantMetadata = req.tenant?.metadata || {};

  return firstFilled(
    organization.logoUrl,
    tenantMetadata.logoUrl,
    tenantMetadata.logo,
    req.tenant?.logoUrl,
  ) || null;
};

const serializeStoreSettings = async (settings, req) => {
  if (!settings) {
    return {
      logoUrl: await resolveStoreLogoFallback(req),
      bannerImageUrl: getLatestGeneratedBannerUrl(req.tenantId),
    };
  }

  const payload = typeof settings.toJSON === 'function' ? settings.toJSON() : { ...settings };
  payload.bannerImageUrl = resolvePublicBannerImageUrl(payload) || getLatestGeneratedBannerUrl(req.tenantId);
  if (!payload.logoUrl) {
    payload.logoUrl = await resolveStoreLogoFallback(req);
  }
  payload.primaryColor = normalizePrimaryColor(payload.primaryColor);

  return payload;
};

const ensureSlugAvailable = async ({ slug, tenantId, currentId = null }) => {
  const existing = await OnlineStoreSettings.findOne({
    where: {
      slug: { [Op.iLike]: slug },
      ...(currentId ? { id: { [Op.ne]: currentId } } : {}),
    },
    attributes: ['id', 'tenantId'],
  });
  if (existing && existing.tenantId !== tenantId) {
    const error = new Error('Store URL is already taken');
    error.statusCode = 400;
    throw error;
  }
  if (existing) {
    const error = new Error('Store URL is already used by another store');
    error.statusCode = 400;
    throw error;
  }
};

const normalizeEnabledMap = (value, defaults = {}) => {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return Object.entries({ ...defaults, ...source }).reduce((acc, [key, option]) => {
    if (option && typeof option === 'object' && !Array.isArray(option)) {
      acc[key] = {
        ...option,
        enabled: option.enabled === true,
      };
    } else {
      acc[key] = { enabled: option === true };
    }
    return acc;
  }, {});
};

const buildSetupChecklist = async (settings, tenantId, req = null) => {
  const productListingsCount = await OnlineProductListing.count({
    where: { tenantId, status: 'published' },
  });
  const serviceListingsCount = req && isStudioTenant(req.tenant?.businessType)
    ? await countPublishedServiceListings(tenantId, settings?.studioLocationId || req.studioLocationFilterId || null)
    : 0;
  const listingsCount = productListingsCount + serviceListingsCount;
  const metadata = settings?.metadata && typeof settings.metadata === 'object' ? settings.metadata : {};
  const paymentMethods = normalizeEnabledMap(metadata.paymentMethods, {
    mobileMoney: { enabled: false, configured: false },
    card: { enabled: false, configured: false },
    bankTransfer: { enabled: false, configured: false },
    payOnDelivery: { enabled: false, configured: false },
  });
  const hasSettings = Boolean(settings?.id);
  const deliveryOptions = normalizeEnabledMap(metadata.deliveryOptions, {
    localDelivery: { enabled: hasSettings && settings?.deliveryEnabled === true, configured: hasSettings && settings?.deliveryEnabled === true },
    nationwideDelivery: { enabled: false, configured: false },
    pickup: { enabled: hasSettings && settings?.pickupEnabled !== false, configured: hasSettings && settings?.pickupEnabled !== false },
    international: { enabled: false, configured: false },
  });
  const hasBasics = Boolean(settings?.displayName && settings?.slug);
  const hasContact = Boolean(settings?.contactPhone || settings?.whatsappNumber || settings?.contactEmail);
  const hasPaymentMethod = Object.values(paymentMethods).some((method) => method.enabled && method.configured !== false);
  const hasFulfillment = Boolean(
    settings?.pickupEnabled ||
    settings?.deliveryEnabled ||
    Object.values(deliveryOptions).some((option) => option.enabled)
  );
  const brandingReady = HEX_COLOR_PATTERN.test(String(settings?.primaryColor || '').trim());
  const canLaunch = hasSettings && hasBasics && hasContact && hasPaymentMethod && hasFulfillment;

  return {
    hasSettings,
    hasBasics,
    brandingReady,
    hasContact,
    hasPaymentMethod,
    hasFulfillment,
    hasPublishedListing: listingsCount > 0,
    listingsCount,
    productListingsCount,
    serviceListingsCount,
    publishedListingWarning: listingsCount < 1,
    storeMode: req && isStudioTenant(req.tenant?.businessType) ? 'studio' : 'shop',
    canLaunch,
    launched: Boolean(settings?.enabled && settings?.setupCompletedAt),
  };
};

const listingPayloadFromBody = (body, product = null) => {
  const title = String(body.title || product?.name || '').trim();
  const slug = normalizeSlug(body.slug || title, 'product');
  const status = LISTING_STATUSES.has(body.status) ? body.status : 'draft';
  const publicPrice = normalizeMoney(body.publicPrice, normalizeMoney(product?.sellingPrice, 0));
  const compareAtPrice =
    body.compareAtPrice === undefined || body.compareAtPrice === null || body.compareAtPrice === ''
      ? null
      : normalizeMoney(body.compareAtPrice, 0);
  const images = normalizeImages(body.images || (product?.imageUrl ? [product.imageUrl] : []));
  const inventoryPolicy = INVENTORY_POLICIES.has(body.inventoryPolicy) ? body.inventoryPolicy : 'track';

  return {
    title,
    slug,
    status,
    shortDescription: body.shortDescription || null,
    description: body.description || product?.description || null,
    salesCopy: body.salesCopy || null,
    publicPrice,
    compareAtPrice,
    images,
    inventoryPolicy,
    sortOrder: Number.isInteger(Number(body.sortOrder)) ? Number(body.sortOrder) : 0,
    publishedAt: status === 'published' ? new Date() : null,
    metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
  };
};

const assertListingPublishable = (listing) => {
  if (!listing.title || !String(listing.title).trim()) {
    const error = new Error('Listing title is required before publishing');
    error.statusCode = 400;
    throw error;
  }
  if (Number.parseFloat(listing.publicPrice) <= 0) {
    const error = new Error('Public price must be greater than zero before publishing');
    error.statusCode = 400;
    throw error;
  }
  const images = normalizeImages(listing.images);
  if (images.length < 1 || images.length > 5) {
    const error = new Error('Published listings need 1 to 5 images');
    error.statusCode = 400;
    throw error;
  }
};

exports.getSettings = async (req, res, next) => {
  try {
    const settings = await getCurrentStoreSettings(req);
    res.status(200).json({ success: true, data: await serializeStoreSettings(settings, req) });
  } catch (error) {
    next(error);
  }
};

exports.upsertSettings = async (req, res, next) => {
  try {
    const existing = await getCurrentStoreSettings(req);
    const displayName = String(req.body.displayName || req.tenant?.name || 'Online store').trim();
    const slug = normalizeSlug(req.body.slug || displayName);
    await ensureSlugAvailable({ slug, tenantId: req.tenantId, currentId: existing?.id || null });

    const incomingMetadata = req.body.metadata && typeof req.body.metadata === 'object' ? req.body.metadata : {};
    const existingMetadata = existing?.metadata && typeof existing.metadata === 'object' ? existing.metadata : {};
    const payload = {
      tenantId: req.tenantId,
      enabled: req.body.enabled === true || req.body.enabled === 'true',
      slug,
      displayName,
      description: req.body.description || null,
      logoUrl: req.body.logoUrl || null,
      bannerImageUrl: req.body.bannerImageUrl || null,
      primaryColor: normalizePrimaryColor(
        req.body.primaryColor,
        normalizePrimaryColor(existing?.primaryColor, DEFAULT_PRIMARY_COLOR),
      ),
      contactPhone: req.body.contactPhone || null,
      whatsappNumber: req.body.whatsappNumber || null,
      contactEmail: req.body.contactEmail || null,
      pickupEnabled: req.body.pickupEnabled !== false,
      deliveryEnabled: req.body.deliveryEnabled === true || req.body.deliveryEnabled === 'true',
      deliveryFee: normalizeMoney(req.body.deliveryFee, 0),
      currency: req.body.currency || DEFAULT_CURRENCY,
      metadata: {
        ...existingMetadata,
        ...incomingMetadata,
        bannerImageUrl: req.body.bannerImageUrl || incomingMetadata.bannerImageUrl || existingMetadata.bannerImageUrl || null,
        paymentMethods: incomingMetadata.paymentMethods || existingMetadata.paymentMethods || {},
        deliveryOptions: incomingMetadata.deliveryOptions || existingMetadata.deliveryOptions || {},
        setupProgress: incomingMetadata.setupProgress || existingMetadata.setupProgress || {},
      },
    };

    attachShopToPayload(req, payload);
    attachStudioLocationToPayload(req, payload);
    if (payload.shopId) {
      assertShopIdAccess(req, payload.shopId);
    }

    if (req.body.setupCompletedAt || req.body.markSetupComplete || payload.enabled) {
      payload.setupCompletedAt = existing?.setupCompletedAt || new Date();
    }

    const settings = existing
      ? await existing.update(payload)
      : await OnlineStoreSettings.create(payload);

    res.status(existing ? 200 : 201).json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
};

exports.getSetupStatus = async (req, res, next) => {
  try {
    const settings = await getCurrentStoreSettings(req);
    const checklist = await buildSetupChecklist(settings, req.tenantId, req);
    res.status(200).json({ success: true, data: { settings, checklist } });
  } catch (error) {
    next(error);
  }
};

exports.checkSlugAvailability = async (req, res, next) => {
  try {
    const slug = normalizeSlug(req.query.slug);
    const existing = await getCurrentStoreSettings(req);
    await ensureSlugAvailable({ slug, tenantId: req.tenantId, currentId: existing?.id || null });
    res.status(200).json({ success: true, data: { slug, available: true } });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(200).json({
        success: true,
        data: { slug: normalizeSlug(req.query.slug), available: false, message: error.message },
      });
    }
    next(error);
  }
};

exports.getListings = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const { status, search, productId } = req.query;
    const where = storeWhereForRequest(req);
    if (status && LISTING_STATUSES.has(status)) where.status = status;
    if (productId) where.productId = productId;
    if (search) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { slug: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { count, rows } = await OnlineProductListing.findAndCountAll({
      where,
      limit,
      offset,
      include: [
        { model: Product, as: 'product', attributes: ['id', 'name', 'sku', 'imageUrl', 'quantityOnHand', 'trackStock'] },
        { model: ProductVariant, as: 'variant', attributes: ['id', 'name', 'sku', 'quantityOnHand'], required: false },
        { model: Shop, as: 'shop', attributes: ['id', 'name'], required: false },
      ],
      order: [['sortOrder', 'ASC'], ['createdAt', 'DESC']],
    });

    res.status(200).json({
      success: true,
      count,
      pagination: { page, limit, totalPages: Math.ceil(count / limit) },
      data: rows,
    });
  } catch (error) {
    next(error);
  }
};

exports.createListing = async (req, res, next) => {
  try {
    const product = await Product.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.body.productId }),
    });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    if (req.shopScoped) {
      assertShopIdAccess(req, product.shopId || req.shopFilterId);
    }

    const payload = {
      ...listingPayloadFromBody(req.body, product),
      tenantId: req.tenantId,
      productId: product.id,
      productVariantId: req.body.productVariantId || null,
      shopId: product.shopId || req.shopFilterId || null,
    };
    if (payload.status === 'published') assertListingPublishable(payload);

    const listing = await OnlineProductListing.create(payload);
    res.status(201).json({ success: true, data: listing });
  } catch (error) {
    next(error);
  }
};

exports.updateListing = async (req, res, next) => {
  try {
    const listing = await OnlineProductListing.findOne({
      where: storeWhereForRequest(req, { id: req.params.id }),
    });
    if (!listing) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }

    const payload = listingPayloadFromBody({ ...listing.get({ plain: true }), ...req.body });
    if (payload.status === 'published') assertListingPublishable(payload);
    if (payload.status !== 'published') payload.publishedAt = null;
    if (listing.status === 'published' && payload.status === 'published' && listing.publishedAt) {
      payload.publishedAt = listing.publishedAt;
    }

    const updated = await listing.update(payload);
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

exports.deleteListing = async (req, res, next) => {
  try {
    const listing = await OnlineProductListing.findOne({
      where: storeWhereForRequest(req, { id: req.params.id }),
    });
    if (!listing) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }
    await listing.destroy();
    res.status(200).json({ success: true, message: 'Listing deleted' });
  } catch (error) {
    next(error);
  }
};

exports.publishListing = async (req, res, next) => {
  try {
    const listing = await OnlineProductListing.findOne({
      where: storeWhereForRequest(req, { id: req.params.id }),
    });
    if (!listing) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }
    assertListingPublishable(listing);
    const updated = await listing.update({ status: 'published', publishedAt: listing.publishedAt || new Date() });
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

exports.unpublishListing = async (req, res, next) => {
  try {
    const listing = await OnlineProductListing.findOne({
      where: storeWhereForRequest(req, { id: req.params.id }),
    });
    if (!listing) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }
    const updated = await listing.update({ status: 'hidden', publishedAt: null });
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

exports.createOrUpdateListingFromProduct = async (req, res, next) => {
  try {
    const product = await Product.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id }),
    });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    if (req.shopScoped) {
      assertShopIdAccess(req, product.shopId || req.shopFilterId);
    }

    const variantId = req.body.productVariantId || null;
    const existing = await OnlineProductListing.findOne({
      where: applyTenantFilter(req.tenantId, {
        productId: product.id,
        productVariantId: variantId,
      }),
    });
    const payload = {
      ...listingPayloadFromBody(req.body, product),
      tenantId: req.tenantId,
      productId: product.id,
      productVariantId: variantId,
      shopId: product.shopId || req.shopFilterId || null,
      metadata: {
        ...(req.body.metadata || {}),
        source: 'product_publish_action',
      },
    };
    if (payload.status === 'published') assertListingPublishable(payload);
    if (existing && existing.status === 'published' && payload.status === 'published' && existing.publishedAt) {
      payload.publishedAt = existing.publishedAt;
    }

    const listing = existing ? await existing.update(payload) : await OnlineProductListing.create(payload);
    res.status(existing ? 200 : 201).json({ success: true, data: listing });
  } catch (error) {
    next(error);
  }
};

exports.uploadListingImages = async (req, res, next) => {
  try {
    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }
    if (files.length > 5) {
      return res.status(400).json({ success: false, message: 'Upload up to 5 images' });
    }

    const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
    const imageUrls = files.map((file) => {
      if (isServerless) {
        const mime = file.mimetype || 'image/jpeg';
        return `data:${mime};base64,${file.buffer.toString('base64')}`;
      }
      const tenantId = req.tenantId;
      const subDir = path.join('store-listings', tenantId);
      const uploadPath = path.join(baseUploadDir, subDir);
      ensureDirExists(uploadPath);
      const ext = path.extname(file.originalname) || '.jpg';
      const sanitized = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_').replace(/\.[^.]+$/, '') || 'listing';
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${sanitized}${ext}`;
      fs.writeFileSync(path.join(uploadPath, filename), file.buffer);
      return `/uploads/store-listings/${tenantId}/${filename}`;
    });

    res.status(200).json({ success: true, data: { imageUrls } });
  } catch (error) {
    next(error);
  }
};

exports.generateBanner = async (req, res, next) => {
  try {
    const prompt = compactInput(req.body.prompt, BANNER_PROMPT_MAX_LENGTH);
    const styleHint = compactInput(req.body.styleHint, BANNER_HINT_MAX_LENGTH);
    const colorHint = compactInput(req.body.colorHint || req.body.primaryColor, 120);

    if (prompt.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Describe the banner you want in at least 8 characters',
      });
    }
    if (String(req.body.prompt || '').length > BANNER_PROMPT_MAX_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Banner prompt must be ${BANNER_PROMPT_MAX_LENGTH} characters or less`,
      });
    }
    if (DISALLOWED_BANNER_PROMPT_TERMS.test([prompt, styleHint].join(' '))) {
      return res.status(400).json({
        success: false,
        message: 'Please use a safe storefront banner prompt',
      });
    }

    const settings = await getCurrentStoreSettings(req);
    const metadata = settings?.metadata && typeof settings.metadata === 'object' ? settings.metadata : {};
    const generated = await openaiService.generateStoreBannerSvg({
      prompt,
      styleHint,
      colorHint,
      tenantId: req.tenantId,
      businessType: req.tenant?.businessType || 'shop',
      storeName: compactInput(req.body.storeName || req.body.displayName || settings?.displayName || req.tenant?.name, 120),
      category: compactInput(req.body.category || metadata.category, 120),
      description: compactInput(req.body.description || settings?.description, 300),
    });
    const imageUrl = await writeGeneratedBannerSvg({ tenantId: req.tenantId, svg: generated.svg });

    res.status(201).json({
      success: true,
      data: {
        imageUrl,
        bannerImageUrl: imageUrl,
        provider: generated.provider,
        model: generated.model,
        format: generated.format,
        width: generated.width,
        height: generated.height,
      },
    });
  } catch (error) {
    if (error.code === 'OPENAI_NOT_CONFIGURED') {
      return res.status(503).json({
        success: false,
        message: 'AI banner generation is not configured. Set ANTHROPIC_API_KEY or a tenant AI key to enable it.',
        code: 'OPENAI_NOT_CONFIGURED',
      });
    }
    if (error.status === 401 || error.code === 'invalid_api_key') {
      return res.status(503).json({
        success: false,
        message: 'Invalid Anthropic API key. Check the workspace AI key or ANTHROPIC_API_KEY in Backend/.env.',
        code: 'OPENAI_INVALID_KEY',
      });
    }
    if (error.code === 'AI_IMAGE_INVALID_OUTPUT') {
      return res.status(502).json({
        success: false,
        message: 'AI could not generate a usable banner. Please try a different prompt.',
        code: 'AI_IMAGE_INVALID_OUTPUT',
      });
    }
    next(error);
  }
};

exports.getStoreOrders = async (req, res, next) => {
  const finishTiming = startHotPathTimer('online_orders.list', req);
  try {
    const { page, limit, offset } = getPagination(req);
    if (isStudioStoreRequest(req)) {
      const { count, rows, stats } = await getMixedStoreOrders(req, { limit, offset });
      finishTiming({ page, limit, count, returned: rows.length, mixed: true });
      return res.status(200).json({
        success: true,
        count,
        stats,
        pagination: {
          page,
          limit,
          totalPages: Math.ceil(count / limit),
        },
        data: rows,
      });
    }

    const where = buildOnlineOrderWhere(req);
    const [{ count, rows }, stats] = await Promise.all([
      Sale.findAndCountAll({
        where,
        attributes: { exclude: ['notes'] },
        include: storeOrderInclude,
        distinct: true,
        subQuery: false,
        limit,
        offset,
        order: [['createdAt', 'DESC']],
      }),
      getOnlineOrderStats(req),
    ]);

    finishTiming({ page, limit, count, returned: rows.length, mixed: false });
    res.status(200).json({
      success: true,
      count,
      stats,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
      data: rows.map(serializeStoreOrder),
    });
  } catch (error) {
    finishTiming({ error: error?.message || 'unknown' });
    next(error);
  }
};

exports.getStoreOrderStats = async (req, res, next) => {
  try {
    const [productStats, serviceStats] = await Promise.all([
      getOnlineOrderStats(req),
      getServiceBookingStats(req),
    ]);
    const stats = combineOrderStats(productStats, serviceStats);
    res.status(200).json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
};

exports.exportStoreOrders = async (req, res, next) => {
  try {
    const { format = 'csv' } = req.query;
    const { sendCSV, sendExcel } = require('../utils/dataExport');
    const where = buildOnlineOrderWhere(req);

    const orders = await Sale.findAll({
      where,
      attributes: { exclude: ['notes'] },
      include: storeOrderInclude,
      order: [['createdAt', 'DESC']],
    });

    if (orders.length === 0) {
      return res.status(404).json({ success: false, message: 'No online orders to export' });
    }

    const rows = getStoreOrderExportRows(orders);
    const filename = `online_orders_${new Date().toISOString().split('T')[0]}`;

    if (format === 'excel') {
      await sendExcel(res, rows, `${filename}.xlsx`, {
        columns: STORE_ORDER_EXPORT_COLUMNS,
        sheetName: 'Online Orders',
        title: 'Online Orders',
      });
    } else {
      sendCSV(res, rows, `${filename}.csv`, STORE_ORDER_EXPORT_COLUMNS);
    }
  } catch (error) {
    next(error);
  }
};

exports.getStoreOrder = async (req, res, next) => {
  try {
    const where = onlineOrderWhereForRequest(req, { id: req.params.id });
    addAndCondition(where, onlineOrderSourceCondition());

    const order = await Sale.findOne({
      where,
      include: storeOrderDetailInclude,
    });

    if (!order && isStudioStoreRequest(req)) {
      const booking = await Job.findOne({
        where: serviceBookingWhereForRequest(req, { id: req.params.id }),
        include: [serviceBookingLeadInclude(req)],
      });
      if (booking) {
        return res.status(200).json({ success: true, data: serializeServiceBookingOrder(booking) });
      }
    }

    if (!order) {
      return res.status(404).json({ success: false, message: 'Online order not found' });
    }

    res.status(200).json({ success: true, data: serializeStoreOrder(order) });
  } catch (error) {
    next(error);
  }
};

exports.updateStoreOrderStatus = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const action = String(req.body.status || req.body.fulfillmentStatus || '').trim();
    if (!STORE_ORDER_STATUS_ACTIONS.has(action)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Use one of: processing, ready, packed, shipped, out_for_delivery, delivered, cancelled',
      });
    }
    const cancellationReason = compactInput(req.body.reason || req.body.cancellationReason, 240);
    if (action === 'cancelled' && !cancellationReason) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Cancellation reason is required.' });
    }

    const where = onlineOrderWhereForRequest(req, { id: req.params.id });
    addAndCondition(where, onlineOrderSourceCondition());

    // Lock Sale row only — FOR UPDATE with optional includes (LEFT JOIN) fails on Postgres.
    const order = await Sale.findOne({
      where,
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!order) {
      if (isStudioStoreRequest(req)) {
        const booking = await Job.findOne({
          where: serviceBookingWhereForRequest(req, { id: req.params.id }),
          include: [serviceBookingLeadInclude(req)],
          transaction,
        });

        if (booking) {
          if (booking.status === 'cancelled') {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'Cancelled service orders cannot be updated' });
          }

          const nextJobStatus = action === 'delivered'
            ? 'completed'
            : action === 'cancelled'
              ? 'cancelled'
              : 'in_progress';
          const currentMetadata = booking.metadata && typeof booking.metadata === 'object' ? booking.metadata : {};
          const fulfillmentHistory = Array.isArray(currentMetadata.fulfillmentHistory)
            ? currentMetadata.fulfillmentHistory
            : [];
          await booking.update({
            status: nextJobStatus,
            metadata: {
              ...currentMetadata,
              fulfillmentStatus: action,
              fulfillmentHistory: [
                ...fulfillmentHistory,
                {
                  action,
                  previousStatus: booking.status,
                  nextStatus: nextJobStatus,
                  actorUserId: req.user?.id || null,
                  at: new Date().toISOString(),
                  ...(action === 'cancelled' ? { reason: cancellationReason } : {}),
                },
              ],
            },
          }, { transaction });

          await transaction.commit();
          const updatedBooking = await Job.findOne({
            where: serviceBookingWhereForRequest(req, { id: req.params.id }),
            include: [serviceBookingLeadInclude(req)],
          });
          return res.status(200).json({ success: true, data: serializeServiceBookingOrder(updatedBooking) });
        }
      }

      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Online order not found' });
    }

    if (['cancelled', 'refunded'].includes(order.status)) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Cancelled or refunded orders cannot be updated' });
    }

    if (hasCustomerConfirmedDelivery(order)) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: CUSTOMER_CONFIRMED_DELIVERY_ERROR_MESSAGE,
        errorCode: CUSTOMER_CONFIRMED_DELIVERY_ERROR_CODE,
      });
    }

    if (!canTransitionStoreOrder(order, action)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Status transition not allowed from ${fulfillmentStateForOrder(order)} to ${targetFulfillmentStateForAction(action)}`,
      });
    }

    const updateData = fulfillmentUpdateForAction(action);
    updateData.metadata = appendDeliveryTrackingMetadata(
      order.metadata,
      action,
      req.user?.id || null,
      action === 'cancelled' ? { reason: cancellationReason } : {}
    );
    const previous = {
      status: order.status,
      orderStatus: order.orderStatus || null,
      deliveryStatus: order.deliveryStatus || null,
    };

    if (action === 'cancelled') {
      await restoreSaleItemStock(order.id, transaction);
    }

    await order.update(updateData, { transaction });
    if (action === 'cancelled') {
      const marketplacePayment = await MarketplaceOrderPayment.findOne({
        where: { saleId: order.id },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (marketplacePayment && marketplacePayment.status !== 'refunded') {
        await refundMarketplaceOrderPayment({
          tenantId: req.tenantId,
          shopId: order.shopId || null,
          saleId: order.id,
          actorUserId: req.user?.id || null,
          reason: `seller_cancelled: ${cancellationReason}`,
          transaction,
        });
      }
    }
    if (action === 'delivered') {
      await markDeliveryReleaseWindowForSale({
        sale: order,
        deliveredAt: order.deliveredAt || new Date(),
        transaction,
      });
    }
    await SaleActivity.create({
      saleId: order.id,
      tenantId: req.tenantId,
      type: action === 'cancelled' ? 'status_change' : 'note',
      subject: 'Online order status updated',
      notes: action === 'cancelled'
        ? `Online order cancelled by seller. Reason: ${cancellationReason}`
        : `Online order marked ${action.replace(/_/g, ' ')}`,
      createdBy: req.user?.id || null,
      metadata: {
        source: ONLINE_STORE_SOURCE,
        action,
        previous,
        next: updateData,
        ...(action === 'cancelled' ? { cancellationReason } : {}),
      },
    }, { transaction });

    await transaction.commit();
    invalidateSaleListCache(req.tenantId);

    const updatedOrder = await Sale.findOne({
      where: { id: order.id, tenantId: req.tenantId },
      include: storeOrderInclude,
    });

    res.status(200).json({ success: true, data: serializeStoreOrder(updatedOrder) });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    next(error);
  }
};

exports.getTradeAssuranceDashboard = async (req, res, next) => {
  try {
    const scope = getTradeAssuranceScope(req);
    const { page, limit, offset } = tradeAssurancePagination(req, 25);
    const [summary, payments, disputes, payouts] = await Promise.all([
      getTradeAssuranceSummary({ tenantId: req.tenantId, ...scope }),
      listTradeAssurancePayments({
        tenantId: req.tenantId,
        ...scope,
        status: req.query?.paymentStatus || null,
        limit,
        offset,
      }),
      listTradeAssuranceDisputes({
        tenantId: req.tenantId,
        ...scope,
        status: req.query?.disputeStatus || null,
        limit: 20,
        offset: 0,
      }),
      listPayoutHistory({
        tenantId: req.tenantId,
        ...scope,
        limit: 20,
        offset: 0,
      }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        summary,
        payments: payments.rows,
        disputes: disputes.rows,
        payouts: payouts.rows,
        pagination: {
          page,
          limit,
          total: payments.count,
          totalPages: Math.ceil(payments.count / limit) || 1,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getTradeAssurancePayments = async (req, res, next) => {
  try {
    const scope = getTradeAssuranceScope(req);
    const { page, limit, offset } = tradeAssurancePagination(req);
    const result = await listTradeAssurancePayments({
      tenantId: req.tenantId,
      ...scope,
      status: req.query?.status || null,
      limit,
      offset,
    });
    res.status(200).json({
      success: true,
      count: result.count,
      pagination: { page, limit, totalPages: Math.ceil(result.count / limit) || 1 },
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
};

exports.getTradeAssuranceDisputes = async (req, res, next) => {
  try {
    const scope = getTradeAssuranceScope(req);
    const { page, limit, offset } = tradeAssurancePagination(req);
    const result = await listTradeAssuranceDisputes({
      tenantId: req.tenantId,
      ...scope,
      status: req.query?.status || null,
      limit,
      offset,
    });
    res.status(200).json({
      success: true,
      count: result.count,
      pagination: { page, limit, totalPages: Math.ceil(result.count / limit) || 1 },
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
};

exports.getTradeAssurancePayouts = async (req, res, next) => {
  try {
    const scope = getTradeAssuranceScope(req);
    const { page, limit, offset } = tradeAssurancePagination(req);
    const result = await listPayoutHistory({
      tenantId: req.tenantId,
      ...scope,
      limit,
      offset,
    });
    res.status(200).json({
      success: true,
      count: result.count,
      pagination: { page, limit, totalPages: Math.ceil(result.count / limit) || 1 },
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
};

exports.releaseTradeAssurancePayout = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const where = onlineOrderWhereForRequest(req, { id: req.params.id });
    addAndCondition(where, onlineOrderSourceCondition());
    const order = await Sale.findOne({
      where,
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!order) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Online marketplace order not found' });
    }

    const payment = await releaseMarketplaceOrderPayment({
      tenantId: req.tenantId,
      shopId: order.shopId || null,
      saleId: order.id,
      actorUserId: req.user?.id || null,
      reason: String(req.body?.reason || 'manual_admin_release').trim().slice(0, 120),
      transaction,
    });

    await transaction.commit();
    invalidateSaleListCache(req.tenantId);
    res.status(200).json({ success: true, message: 'Marketplace payout released.', data: payment });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    next(error);
  }
};

exports.refundTradeAssuranceOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const where = onlineOrderWhereForRequest(req, { id: req.params.id });
    addAndCondition(where, onlineOrderSourceCondition());
    const order = await Sale.findOne({
      where,
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!order) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Online marketplace order not found' });
    }

    const payment = await refundMarketplaceOrderPayment({
      tenantId: req.tenantId,
      shopId: order.shopId || null,
      saleId: order.id,
      amount: req.body?.amount,
      actorUserId: req.user?.id || null,
      reason: String(req.body?.reason || 'admin_refund').trim().slice(0, 160),
      transaction,
    });

    await transaction.commit();
    invalidateSaleListCache(req.tenantId);
    res.status(200).json({ success: true, message: 'Marketplace refund recorded.', data: payment });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    next(error);
  }
};

exports.getMarketplaceStores = async (req, res, next) => {
  try {
    const page = marketplacePage(req.query.page);
    const limit = marketplaceLimit(req.query.limit, 12, 48);
    const offset = (page - 1) * limit;
    const search = String(req.query.search || '').trim();
    const shopTypes = parseShopTypeFilter(req.query.shopType);
    const where = publicStoreWhere();

    if (search) {
      where[Op.or] = [
        { displayName: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
        { slug: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { count, rows } = await OnlineStoreSettings.findAndCountAll({
      where,
      limit,
      offset,
      distinct: true,
      attributes: [
        'id',
        'tenantId',
        'shopId',
        'studioLocationId',
        'slug',
        'displayName',
        'description',
        'logoUrl',
        'bannerImageUrl',
        'primaryColor',
        'currency',
        'pickupEnabled',
        'deliveryEnabled',
        'deliveryFee',
        'metadata',
      ],
      include: buildPublicStoreInclude(shopTypes),
      order: [['createdAt', 'DESC']],
    });

    const [listingCounts, categoryResult] = await Promise.all([
      getStoreListingCounts(rows),
      getCategoryCountsForStores(rows),
    ]);
    const storesWithReviews = await attachStoreReviewSummaries(rows);
    const data = storesWithReviews.map((store) => {
      const key = `${store.tenantId}:${store.shopId || ''}`;
      return toPublicStoreCard(store, {
        listingCount: listingCounts.get(key) || 0,
        categoryCounts: categoryResult.storeCategories,
      });
    });

    res.status(200).json({
      success: true,
      count,
      pagination: { page, limit, totalPages: Math.ceil(count / limit) },
      data,
    });
  } catch (error) {
    next(error);
  }
};

exports.getMarketplaceCategories = async (req, res, next) => {
  try {
    const stores = await OnlineStoreSettings.findAll({
      where: publicStoreWhere(),
      attributes: ['id', 'tenantId', 'shopId'],
      include: publicStoreInclude,
      order: [['createdAt', 'DESC']],
      limit: 200,
    });
    const { categories } = await getCategoryCountsForStores(stores);
    res.status(200).json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
};

exports.getMarketplaceProducts = async (req, res, next) => {
  try {
    const page = marketplacePage(req.query.page);
    const limit = marketplaceLimit(req.query.limit, 12, 48);
    const offset = (page - 1) * limit;
    const search = String(req.query.search || '').trim();
    const category = String(req.query.category || '').trim();
    const storeSlug = String(req.query.storeSlug || '').trim();
    const shopTypes = parseShopTypeFilter(req.query.shopType);
    const storeWhere = publicStoreWhere(storeSlug ? { slug: { [Op.iLike]: normalizeSlug(storeSlug) } } : {});
    const stores = await OnlineStoreSettings.findAll({
      where: storeWhere,
      attributes: [
        'id',
        'tenantId',
        'shopId',
        'slug',
        'displayName',
        'description',
        'logoUrl',
        'bannerImageUrl',
        'primaryColor',
        'currency',
        'pickupEnabled',
        'deliveryEnabled',
        'deliveryFee',
        'metadata',
      ],
      include: buildPublicStoreInclude(shopTypes),
      limit: 200,
    });
    const where = buildStoreListingWhere(stores);

    if (!where) {
      return res.status(200).json({
        success: true,
        count: 0,
        pagination: { page, limit, totalPages: 0 },
        data: [],
      });
    }

    if (search) {
      const searchPattern = `%${search}%`;
      const matchingStores = stores.filter((store) => {
        const plain = typeof store.get === 'function' ? store.get({ plain: true }) : store;
        return [plain.displayName, plain.slug, plain.description]
          .some((value) => String(value || '').toLowerCase().includes(search.toLowerCase()));
      });
      const searchConditions = [
        { title: { [Op.iLike]: searchPattern } },
        { shortDescription: { [Op.iLike]: searchPattern } },
        { '$product.name$': { [Op.iLike]: searchPattern } },
        ...matchingStores.map((store) => ({
          tenantId: store.tenantId,
          ...(store.shopId ? { shopId: store.shopId } : {}),
        })),
      ];
      where[Op.and] = [
        ...(Array.isArray(where[Op.and]) ? where[Op.and] : []),
        { [Op.or]: searchConditions },
      ];
    }

    const productInclude = publicListingIncludes.map((include) => {
      if (include.as !== 'product' || !category) return include;
      return {
        ...include,
        include: include.include.map((nested) => (
          nested.as === 'category'
            ? { ...nested, required: true, where: { ...nested.where, name: { [Op.iLike]: category } } }
            : nested
        )),
      };
    });

    const rows = await OnlineProductListing.findAll({
      where,
      subQuery: false,
      attributes: [
        'id',
        'tenantId',
        'shopId',
        'productId',
        'productVariantId',
        'title',
        'slug',
        'shortDescription',
        'publicPrice',
        'compareAtPrice',
        'images',
        'inventoryPolicy',
        'sortOrder',
        'publishedAt',
      ],
      include: productInclude,
      order: [['sortOrder', 'ASC'], ['publishedAt', 'DESC']],
    });

    const [availableListingResult, storesWithReviews] = await Promise.all([
      getAvailableListingsWithVariants(rows),
      attachStoreReviewSummaries(stores),
    ]);
    const count = availableListingResult.listings.length;
    const pageRows = availableListingResult.listings.slice(offset, offset + limit);
    const products = pageRows.map((listing) => (
      toMarketplaceProduct(listing, storesWithReviews, availableListingResult.variantsByProductId)
    ));
    const data = await attachProductReviewSummaries(products);

    res.status(200).json({
      success: true,
      count,
      pagination: { page, limit, totalPages: Math.ceil(count / limit) },
      data,
    });
  } catch (error) {
    next(error);
  }
};

exports.getMarketplaceProduct = async (req, res, next) => {
  try {
    const idOrSlug = String(req.params.idOrSlug || '').trim();
    if (!idOrSlug) {
      return res.status(400).json({ success: false, message: 'Product identifier is required.' });
    }

    const isUuid = /^[0-9a-f-]{36}$/i.test(idOrSlug);
    const listing = await OnlineProductListing.findOne({
      where: {
        status: 'published',
        ...(isUuid
          ? { id: idOrSlug }
          : { slug: { [Op.iLike]: normalizeSlug(idOrSlug) } }),
      },
      include: publicListingIncludes,
    });

    if (!listing) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const store = await OnlineStoreSettings.findOne({
      where: {
        tenantId: listing.tenantId,
        ...(listing.shopId ? { shopId: listing.shopId } : {}),
        ...publicStoreWhere(),
      },
      attributes: [
        'id',
        'tenantId',
        'shopId',
        'slug',
        'displayName',
        'description',
        'logoUrl',
        'bannerImageUrl',
        'primaryColor',
        'currency',
        'pickupEnabled',
        'deliveryEnabled',
        'deliveryFee',
        'metadata',
      ],
      include: publicStoreInclude,
    });

    if (!store) {
      return res.status(404).json({ success: false, message: 'Store not found for this product.' });
    }

    const [availableListingResult, storesWithReviews, salesCounts] = await Promise.all([
      getAvailableListingsWithVariants([listing]),
      attachStoreReviewSummaries([store]),
      getStoreSalesCounts(store, [listing.productId].filter(Boolean)),
    ]);

    const availableListing = availableListingResult.listings[0];
    if (!availableListing) {
      return res.status(404).json({ success: false, message: 'Product is not available.' });
    }

    const product = toPublicStoreProduct(
      availableListing,
      storesWithReviews[0] || store,
      availableListingResult.variantsByProductId,
      salesCounts.get(listing.productId) || 0,
    );
    const [withReviews] = await attachProductReviewSummaries([product]);

    return res.status(200).json({
      success: true,
      data: withReviews,
    });
  } catch (error) {
    next(error);
  }
};

exports.getMarketplaceHome = async (req, res, next) => {
  const finishTiming = startHotPathTimer('marketplace.home', req);
  try {
    const stores = await OnlineStoreSettings.findAll({
      where: publicStoreWhere(),
      attributes: [
        'id',
        'tenantId',
        'shopId',
        'slug',
        'displayName',
        'description',
        'logoUrl',
        'bannerImageUrl',
        'primaryColor',
        'currency',
        'pickupEnabled',
        'deliveryEnabled',
        'metadata',
      ],
      include: publicStoreInclude,
      order: [['createdAt', 'DESC']],
      limit: 24,
    });
    const [listingCounts, categoryResult] = await Promise.all([
      getStoreListingCounts(stores),
      getCategoryCountsForStores(stores),
    ]);
    const storesWithReviews = await attachStoreReviewSummaries(stores);
    const popularStores = storesWithReviews.map((store) => {
      const key = `${store.tenantId}:${store.shopId || ''}`;
      return toPublicStoreCard(store, {
        listingCount: listingCounts.get(key) || 0,
        categoryCounts: categoryResult.storeCategories,
      });
    }).filter((store) => store.productCount > 0).slice(0, 6);

    const productWhere = buildStoreListingWhere(stores);
    const featuredRows = productWhere
      ? await OnlineProductListing.findAll({
        where: productWhere,
        attributes: [
          'id',
          'tenantId',
          'shopId',
          'productId',
          'productVariantId',
          'title',
          'slug',
          'shortDescription',
          'publicPrice',
          'compareAtPrice',
          'images',
          'inventoryPolicy',
          'sortOrder',
          'publishedAt',
        ],
        include: publicListingIncludes,
        order: [['sortOrder', 'ASC'], ['publishedAt', 'DESC']],
        limit: 48,
      })
      : [];
    const { variantsByProductId, listings: availableFeaturedRows } = await getAvailableListingsWithVariants(featuredRows);
    const featuredProducts = await attachProductReviewSummaries(
      availableFeaturedRows
        .slice(0, 8)
        .map((listing) => toMarketplaceProduct(listing, storesWithReviews, variantsByProductId))
    );

    const studioData = await getStudioMarketplaceHomeData();

    finishTiming({
      stores: stores.length,
      featuredProducts: featuredProducts.length,
      popularStores: popularStores.length,
    });
    res.status(200).json({
      success: true,
      data: {
        hero: {
          eyebrow: 'Sabito Store',
          title: 'One Marketplace. Many Stores. Endless Choices.',
          description: 'Discover products and services from trusted Sabito businesses in one public marketplace.',
        },
        categories: categoryResult.categories.slice(0, 8),
        popularStores,
        featuredProducts,
        serviceCategories: studioData.categories,
        popularStudios: studioData.popularStudios,
        featuredServices: studioData.featuredServices,
      },
    });
  } catch (error) {
    finishTiming({ error: error?.message || 'unknown' });
    next(error);
  }
};

const buildFoodCuisineChips = (stores) => {
  const counts = new Map();
  stores.forEach((store) => {
    const plain = typeof store.get === 'function' ? store.get({ plain: true }) : store;
    const { cuisineTags } = extractFoodMetadata(plain);
    cuisineTags.forEach((tag) => {
      const key = tag.toLowerCase();
      counts.set(key, { label: tag, count: (counts.get(key)?.count || 0) + 1 });
    });
  });
  return [...counts.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).slice(0, 12);
};

const isFoodStore = (store) => {
  const plain = typeof store.get === 'function' ? store.get({ plain: true }) : store;
  const shopType = plain?.shop?.shopType || extractFoodMetadata(plain).shopType;
  return FOOD_SHOP_TYPES.includes(shopType);
};

const isGroceryStore = (store) => {
  const plain = typeof store.get === 'function' ? store.get({ plain: true }) : store;
  const shopType = plain?.shop?.shopType || extractFoodMetadata(plain).shopType;
  return shopType === 'supermarket' || shopType === 'convenience';
};

const isProductStore = (store) => !isFoodStore(store);

exports.getMarketplaceProductsHome = async (req, res, next) => {
  const finishTiming = startHotPathTimer('marketplace.products_home', req);
  try {
    const stores = await OnlineStoreSettings.findAll({
      where: publicStoreWhere(),
      attributes: [
        'id',
        'tenantId',
        'shopId',
        'slug',
        'displayName',
        'description',
        'logoUrl',
        'bannerImageUrl',
        'primaryColor',
        'currency',
        'pickupEnabled',
        'deliveryEnabled',
        'deliveryFee',
        'metadata',
      ],
      include: publicStoreInclude,
      order: [['createdAt', 'DESC']],
      limit: 48,
    });

    const productStores = stores.filter(isProductStore);
    const [listingCounts, categoryResult] = await Promise.all([
      getStoreListingCounts(productStores),
      getCategoryCountsForStores(productStores),
    ]);
    const storesWithReviews = await attachStoreReviewSummaries(productStores);
    const storeCards = storesWithReviews
      .map((store) => {
        const key = `${store.tenantId}:${store.shopId || ''}`;
        return toPublicStoreCard(store, {
          listingCount: listingCounts.get(key) || 0,
          categoryCounts: categoryResult.storeCategories,
        });
      })
      .filter((store) => store.productCount > 0);

    const productWhere = buildStoreListingWhere(productStores);
    const listingRows = productWhere
      ? await OnlineProductListing.findAll({
        where: productWhere,
        attributes: [
          'id',
          'tenantId',
          'shopId',
          'productId',
          'productVariantId',
          'title',
          'slug',
          'shortDescription',
          'publicPrice',
          'compareAtPrice',
          'images',
          'inventoryPolicy',
          'sortOrder',
          'publishedAt',
        ],
        include: publicListingIncludes,
        order: [['publishedAt', 'DESC']],
        limit: 120,
      })
      : [];
    const { variantsByProductId, listings: availableListings } = await getAvailableListingsWithVariants(listingRows);
    const products = await attachProductReviewSummaries(
      availableListings.map((listing) => toMarketplaceProduct(listing, storesWithReviews, variantsByProductId))
    );

    const featuredProducts = products.slice(0, 8);
    const newArrivals = [...products]
      .sort((a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime())
      .slice(0, 8);
    const bestDeals = products.filter((product) => product.onSale).slice(0, 8);
    const deliveryStores = storeCards.filter((store) => store.deliveryEnabled).slice(0, 8);

    finishTiming({
      stores: productStores.length,
      products: products.length,
      popularStores: storeCards.length,
    });
    res.status(200).json({
      success: true,
      data: {
        hero: {
          eyebrow: 'Sabito Store Products',
          title: 'Shop products from trusted local stores',
          description: 'Browse categories, compare deals, and order from one store at a time with delivery or pickup.',
        },
        categories: categoryResult.categories.slice(0, 12),
        popularStores: storeCards.slice(0, 10),
        featuredProducts,
        newArrivals,
        bestDeals,
        deliveryStores,
        hasVendors: storeCards.length > 0,
      },
    });
  } catch (error) {
    finishTiming({ error: error?.message || 'unknown' });
    next(error);
  }
};

exports.getMarketplaceFoodHome = async (req, res, next) => {
  const finishTiming = startHotPathTimer('marketplace.food_home', req);
  try {
    const stores = await OnlineStoreSettings.findAll({
      where: publicStoreWhere(),
      attributes: [
        'id',
        'tenantId',
        'shopId',
        'slug',
        'displayName',
        'description',
        'logoUrl',
        'bannerImageUrl',
        'primaryColor',
        'currency',
        'pickupEnabled',
        'deliveryEnabled',
        'deliveryFee',
        'metadata',
      ],
      include: buildPublicStoreInclude(FOOD_SHOP_TYPES),
      order: [['createdAt', 'DESC']],
      limit: 48,
    });

    const [listingCounts, categoryResult] = await Promise.all([
      getStoreListingCounts(stores),
      getCategoryCountsForStores(stores),
    ]);
    const storesWithReviews = await attachStoreReviewSummaries(stores);
    const storeCards = storesWithReviews
      .map((store) => {
        const key = `${store.tenantId}:${store.shopId || ''}`;
        return toPublicStoreCard(store, {
          listingCount: listingCounts.get(key) || 0,
          categoryCounts: categoryResult.storeCategories,
        });
      })
      .filter((store) => store.productCount > 0);

    const restaurants = storeCards.filter((store) => store.shopType === 'restaurant');
    const groceries = storeCards.filter((store) => isGroceryStore({ shop: { shopType: store.shopType } }));
    const openNearYou = storeCards
      .filter((store) => store.isOpenNow !== false && store.deliveryEnabled)
      .slice(0, 8);
    const fastDelivery = [...storeCards]
      .filter((store) => store.deliveryEnabled && store.avgPrepMinutes)
      .sort((a, b) => (a.avgPrepMinutes || 999) - (b.avgPrepMinutes || 999))
      .slice(0, 8);

    const productWhere = buildStoreListingWhere(storesWithReviews);
    const listingRows = productWhere
      ? await OnlineProductListing.findAll({
        where: productWhere,
        attributes: [
          'id',
          'tenantId',
          'shopId',
          'productId',
          'productVariantId',
          'title',
          'slug',
          'shortDescription',
          'publicPrice',
          'compareAtPrice',
          'images',
          'inventoryPolicy',
          'sortOrder',
          'publishedAt',
        ],
        include: publicListingIncludes,
        order: [['publishedAt', 'DESC']],
        limit: 120,
      })
      : [];
    const { variantsByProductId, listings: availableListings } = await getAvailableListingsWithVariants(listingRows);
    const products = await attachProductReviewSummaries(
      availableListings.map((listing) => toMarketplaceProduct(listing, storesWithReviews, variantsByProductId))
    );

    const restaurantStoreKeys = new Set(
      storesWithReviews.filter(isFoodStore).map((store) => `${store.tenantId}:${store.shopId || ''}`)
    );
    const groceryStoreKeys = new Set(
      storesWithReviews.filter(isGroceryStore).map((store) => `${store.tenantId}:${store.shopId || ''}`)
    );

    const popularMeals = products
      .filter((product) => {
        const store = storesWithReviews.find((candidate) => candidate.slug === product.store?.slug);
        if (!store) return false;
        const key = `${store.tenantId}:${store.shopId || ''}`;
        return restaurantStoreKeys.has(key);
      })
      .slice(0, 12);

    const groceryProducts = products.filter((product) => {
      const store = storesWithReviews.find((candidate) => candidate.slug === product.store?.slug);
      if (!store) return false;
      const key = `${store.tenantId}:${store.shopId || ''}`;
      if (!groceryStoreKeys.has(key)) return false;
      const categoryName = product.category?.name || '';
      return GROCERY_CATEGORY_PATTERN.test(categoryName) || !DRINK_CATEGORY_PATTERN.test(categoryName);
    }).slice(0, 12);

    const drinkProducts = products.filter((product) => {
      const categoryName = product.category?.name || '';
      return DRINK_CATEGORY_PATTERN.test(categoryName) || DRINK_CATEGORY_PATTERN.test(product.title || '');
    }).slice(0, 12);

    finishTiming({
      stores: stores.length,
      products: products.length,
      restaurants: restaurants.length,
    });
    res.status(200).json({
      success: true,
      data: {
        hero: {
          eyebrow: 'Sabito Store Food',
          title: 'Order food and groceries near you',
          description: 'Discover restaurants, meals, drinks, and groceries from trusted Sabito vendors.',
        },
        cuisineChips: buildFoodCuisineChips(storesWithReviews),
        openNearYou: openNearYou.length ? openNearYou : restaurants.slice(0, 8),
        restaurants: restaurants.slice(0, 12),
        popularMeals,
        groceries: groceries.length ? groceries : groceryProducts.map((product) => product.store).filter(Boolean).slice(0, 8),
        groceryProducts,
        drinks: drinkProducts,
        fastDelivery: fastDelivery.length ? fastDelivery : restaurants.filter((store) => store.deliveryEnabled).slice(0, 8),
        hasVendors: storeCards.length > 0,
      },
    });
  } catch (error) {
    finishTiming({ error: error?.message || 'unknown' });
    next(error);
  }
};

exports.getMarketplaceStoreHome = async (req, res, next) => {
  const finishTiming = startHotPathTimer('marketplace.store_home', req);
  try {
    const store = await OnlineStoreSettings.findOne({
      where: publicStoreWhere({ slug: { [Op.iLike]: normalizeSlug(req.params.slug) } }),
      attributes: [
        'id',
        'tenantId',
        'shopId',
        'slug',
        'displayName',
        'description',
        'logoUrl',
        'bannerImageUrl',
        'primaryColor',
        'contactPhone',
        'whatsappNumber',
        'contactEmail',
        'pickupEnabled',
        'deliveryEnabled',
        'deliveryFee',
        'currency',
        'metadata',
      ],
      include: publicStoreInclude,
    });

    if (!store) {
      return res.status(404).json({ success: false, message: 'Store not found or not launched' });
    }

    const listingWhere = buildStoreListingWhere([store]);
    const serviceListingWhere = buildStoreServiceListingWhere(store);
    const listings = listingWhere
      ? await OnlineProductListing.findAll({
        where: listingWhere,
        attributes: [
          'id',
          'tenantId',
          'shopId',
          'productId',
          'productVariantId',
          'title',
          'slug',
          'shortDescription',
          'publicPrice',
          'compareAtPrice',
          'images',
          'inventoryPolicy',
          'sortOrder',
          'publishedAt',
        ],
        include: publicListingIncludes,
        order: [['sortOrder', 'ASC'], ['publishedAt', 'DESC']],
        limit: 80,
      })
      : [];
    const serviceListings = serviceListingWhere
      ? await OnlineServiceListing.findAll({
        where: serviceListingWhere,
        attributes: [
          'id',
          'tenantId',
          'studioLocationId',
          'title',
          'slug',
          'shortDescription',
          'description',
          'category',
          'ctaType',
          'priceType',
          'startingPrice',
          'compareAtPrice',
          'durationMinutes',
          'turnaroundLabel',
          'images',
          'pickupEnabled',
          'deliveryEnabled',
          'sortOrder',
          'publishedAt',
        ],
        order: [['sortOrder', 'ASC'], ['publishedAt', 'DESC']],
        limit: 80,
      })
      : [];

    const [availableListingResult, reviewSummary, salesCounts] = await Promise.all([
      getAvailableListingsWithVariants(listings),
      getPublicStoreReviewSummary(store),
      getStoreSalesCounts(
        store,
        [...new Set(listings.map((listing) => listing.productId).filter(Boolean))]
      ),
    ]);
    const { variantsByProductId, listings: availableListings } = availableListingResult;

    const products = await attachProductReviewSummaries(availableListings.map((listing) => (
      toPublicStoreProduct(listing, store, variantsByProductId, salesCounts.get(listing.productId) || 0)
    )));
    const services = await attachServiceReviewSummaries(
      serviceListings.map((listing) => toPublicStoreService(listing, store))
    );
    const categories = getStoreCategoriesFromListings(availableListings);
    const serviceCategories = getServiceCategoriesFromServices(services);
    const productsBySales = [...products]
      .filter((product) => Number(product.salesCount || 0) > 0)
      .sort((a, b) => Number(b.salesCount || 0) - Number(a.salesCount || 0));
    const newArrivals = [...products].sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
    const discountedProduct = products.find((product) => (
      Number.parseFloat(product.compareAtPrice || 0) > Number.parseFloat(product.publicPrice || 0)
    ));
    const metadata = store.metadata && typeof store.metadata === 'object' ? store.metadata : {};

    finishTiming({
      slug: store.slug,
      products: products.length,
      services: services.length,
    });
    res.status(200).json({
      success: true,
      data: {
        store: toPublicStoreHomeProfile(store, {
          productCount: products.length,
          serviceCount: services.length,
          categories: products.length ? categories : serviceCategories,
          reviewSummary,
        }),
        categories,
        serviceCategories,
        products,
        services,
        featuredProducts: products.slice(0, 8),
        featuredServices: services.slice(0, 8),
        secondaryServices: [...services]
          .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0))
          .slice(0, 8),
        secondaryProducts: (productsBySales.length ? productsBySales : newArrivals).slice(0, 8),
        secondaryProductsLabel: productsBySales.length ? 'Best Selling Products' : 'New Arrivals',
        promotionalBanner: metadata.promoBanner || metadata.promotionalBanner || (discountedProduct ? {
          title: 'Featured deal',
          description: discountedProduct.shortDescription || discountedProduct.title,
          product: discountedProduct,
        } : null),
        reviews: reviewSummary.reviews,
      },
    });
  } catch (error) {
    finishTiming({ error: error?.message || 'unknown' });
    next(error);
  }
};

exports.getPublicStore = async (req, res, next) => {
  try {
    const store = await OnlineStoreSettings.findOne({
      where: { slug: { [Op.iLike]: normalizeSlug(req.params.slug) }, enabled: true },
      attributes: {
        exclude: ['tenantId', 'metadata', 'createdAt', 'updatedAt'],
      },
    });
    if (!store) {
      return res.status(404).json({ success: false, message: 'Store not found or not launched' });
    }
    res.status(200).json({ success: true, data: store });
  } catch (error) {
    next(error);
  }
};

exports.getPublicStoreProducts = async (req, res, next) => {
  try {
    const store = await OnlineStoreSettings.findOne({
      where: publicStoreWhere({ slug: { [Op.iLike]: normalizeSlug(req.params.slug) } }),
      attributes: ['tenantId', 'shopId', 'currency'],
      include: publicStoreInclude,
    });
    if (!store) {
      return res.status(404).json({ success: false, message: 'Store not found or not launched' });
    }
    const where = {
      tenantId: store.tenantId,
      status: 'published',
      ...(store.shopId ? { shopId: store.shopId } : {}),
    };
    const listings = await OnlineProductListing.findAll({
      where,
      attributes: [
        'id',
        'productId',
        'productVariantId',
        'title',
        'slug',
        'shortDescription',
        'description',
        'publicPrice',
        'compareAtPrice',
        'images',
        'inventoryPolicy',
        'sortOrder',
      ],
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'quantityOnHand', 'unit', 'hasVariants', 'trackStock'],
          required: true,
          where: {
            tenantId: store.tenantId,
            isActive: true,
            ...(store.shopId ? { shopId: store.shopId } : {}),
          },
        },
        {
          model: ProductVariant,
          as: 'variant',
          attributes: ['id', 'productId', 'name', 'quantityOnHand', 'trackStock'],
          required: false,
          where: { isActive: true },
        },
      ],
      order: [['sortOrder', 'ASC'], ['publishedAt', 'DESC']],
    });
    const { variantsByProductId, listings: availableListings } = await getAvailableListingsWithVariants(listings);
    const payload = await attachProductReviewSummaries(
      availableListings.map((listing) => buildListingAvailability(listing, variantsByProductId))
    );
    res.status(200).json({ success: true, data: payload, currency: store.currency });
  } catch (error) {
    next(error);
  }
};
