const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const {
  OnlineProductListing,
  OnlineServiceListing,
  OnlineStoreSettings,
  Job,
  Lead,
  Product,
  ProductVariant,
  Sale,
  SaleItem,
  StorefrontCustomer,
  StorefrontReview,
  Tenant,
  Shop,
} = require('../models');

const ONLINE_STORE_SOURCE = 'online_store';
const REVIEW_COMMENT_MAX_LENGTH = 1000;
const REVIEW_TITLE_MAX_LENGTH = 120;
const DEFAULT_SUMMARY = {
  rating: null,
  reviewsCount: 0,
  positiveReviewsPercent: null,
  reviews: [],
};

const isMissingReviewsTableError = (error) => {
  const code = error?.parent?.code || error?.original?.code;
  const message = String(error?.message || error?.parent?.message || '');
  return code === '42P01' || /relation ["']?storefront_reviews["']? does not exist/i.test(message);
};

const attachStoresWithoutReviews = (stores = []) => stores.map((store) => {
  const plain = typeof store?.get === 'function' ? store.get({ plain: true }) : store;
  return {
    ...plain,
    rating: DEFAULT_SUMMARY.rating,
    reviewsCount: DEFAULT_SUMMARY.reviewsCount,
    reviewSummary: { ...DEFAULT_SUMMARY },
  };
});

const attachProductsWithoutReviews = (products = []) => products.map((product) => ({
  ...product,
  rating: DEFAULT_SUMMARY.rating,
  reviewsCount: DEFAULT_SUMMARY.reviewsCount,
  reviewSummary: { ...DEFAULT_SUMMARY },
}));

const compact = (value, max = 255) => String(value || '').trim().slice(0, max);
const normalizeEmail = (value) => compact(value, 255).toLowerCase();
const normalizePhone = (value) => String(value || '').replace(/\D/g, '');

const getSaleMetadata = (sale) => (
  sale?.metadata && typeof sale.metadata === 'object' && !Array.isArray(sale.metadata)
    ? { ...sale.metadata }
    : {}
);

const toPlain = (record) => (typeof record?.get === 'function' ? record.get({ plain: true }) : record);

const saleMetadataJsonKey = (key) => sequelize.literal(`"Sale"."metadata"->>'${key}'`);

const shopperOrderWhere = (shopperId, extra = {}) => ({
  ...extra,
  [Op.and]: [
    ...(extra[Op.and] || []),
    sequelize.where(saleMetadataJsonKey('source'), ONLINE_STORE_SOURCE),
    sequelize.where(saleMetadataJsonKey('storefrontCustomerId'), shopperId),
  ],
});

const isSellerMarkedDelivered = (sale) => (
  sale?.deliveryStatus === 'delivered' || ['completed', 'delivered'].includes(sale?.orderStatus)
);

const isReviewableDeliveredOrder = (sale) => {
  if (!sale || ['cancelled', 'refunded'].includes(sale.status)) return false;
  if (!isSellerMarkedDelivered(sale)) return false;
  return true;
};

const reviewBlockedReason = (sale) => {
  if (!sale) return 'No delivered purchase was found for this shopper.';
  if (['cancelled', 'refunded'].includes(sale.status)) return 'Cancelled or refunded orders cannot be reviewed.';
  if (!isSellerMarkedDelivered(sale)) return 'You can review after the seller marks the order delivered.';
  return null;
};

const getPublicReviewerName = (customer) => {
  const rawName = compact(customer?.name || '', 160);
  if (!rawName) return 'Verified shopper';
  const [firstName] = rawName.split(/\s+/).filter(Boolean);
  return firstName ? `${firstName} ${rawName.length > firstName.length ? `${rawName.slice(firstName.length).trim().charAt(0)}.` : ''}`.trim() : 'Verified shopper';
};

const serializeReview = (review) => {
  const plain = typeof review?.get === 'function' ? review.get({ plain: true }) : review;
  if (!plain) return null;
  return {
    id: plain.id,
    reviewType: plain.reviewType,
    rating: Number(plain.rating || 0),
    title: plain.title || null,
    comment: plain.comment || '',
    verified: Boolean(plain.verifiedAt),
    reviewerName: getPublicReviewerName(plain.storefrontCustomer),
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
};

const summarizeReviews = (reviews = [], { includeList = true, listLimit = 20 } = {}) => {
  const published = reviews.filter((review) => review?.status === 'published');
  if (!published.length) return { ...DEFAULT_SUMMARY };

  const ratingTotal = published.reduce((sum, review) => sum + Number(review.rating || 0), 0);
  const positiveReviews = published.filter((review) => Number(review.rating || 0) >= 4).length;
  return {
    rating: Number((ratingTotal / published.length).toFixed(1)),
    reviewsCount: published.length,
    positiveReviewsPercent: Math.round((positiveReviews / published.length) * 100),
    reviews: includeList
      ? published
        .slice(0, listLimit)
        .map(serializeReview)
        .filter(Boolean)
      : [],
  };
};

const getPublicReviewSummary = async ({
  reviewType,
  tenantId,
  shopId = null,
  studioLocationId = null,
  listingId = null,
  serviceListingId = null,
  limit = 20,
}) => {
  const where = {
    reviewType,
    status: 'published',
    ...(reviewType === 'product' ? { listingId } : {}),
    ...(reviewType === 'service' ? { serviceListingId } : {}),
    ...(reviewType === 'store' ? { tenantId, shopId, studioLocationId } : {}),
  };
  try {
    const reviews = await StorefrontReview.findAll({
      where,
      include: [{ model: StorefrontCustomer, as: 'storefrontCustomer', attributes: ['id', 'name'], required: false }],
      order: [['createdAt', 'DESC']],
      limit: Math.max(limit, 50),
    });
    return summarizeReviews(reviews, { includeList: true, listLimit: limit });
  } catch (error) {
    if (isMissingReviewsTableError(error)) {
      return { ...DEFAULT_SUMMARY };
    }
    throw error;
  }
};

const attachProductReviewSummaries = async (products = []) => {
  const listingIds = [...new Set(products.map((product) => product?.id || product?.listingId).filter(Boolean))];
  if (!listingIds.length) return products;

  let reviews;
  try {
    reviews = await StorefrontReview.findAll({
      where: {
        reviewType: 'product',
        listingId: { [Op.in]: listingIds },
        status: 'published',
      },
      include: [{ model: StorefrontCustomer, as: 'storefrontCustomer', attributes: ['id', 'name'], required: false }],
      order: [['createdAt', 'DESC']],
    });
  } catch (error) {
    if (isMissingReviewsTableError(error)) {
      return attachProductsWithoutReviews(products);
    }
    throw error;
  }
  const reviewsByListingId = reviews.reduce((map, review) => {
    const key = review.listingId;
    const current = map.get(key) || [];
    current.push(review);
    map.set(key, current);
    return map;
  }, new Map());

  return products.map((product) => {
    const listingId = product?.listingId || product?.id;
    const summary = summarizeReviews(reviewsByListingId.get(listingId) || [], { includeList: false });
    return {
      ...product,
      rating: summary.rating,
      reviewsCount: summary.reviewsCount,
      reviewSummary: summary,
    };
  });
};

const attachStoreReviewSummaries = async (stores = []) => {
  const normalizedStores = stores
    .map((store) => (typeof store?.get === 'function' ? store.get({ plain: true }) : store))
    .filter((store) => store?.tenantId);
  if (!normalizedStores.length) return stores;

  let reviews;
  try {
    reviews = await StorefrontReview.findAll({
      where: {
        reviewType: 'store',
        status: 'published',
        [Op.or]: normalizedStores.map((store) => ({
          tenantId: store.tenantId,
          shopId: store.shopId || null,
          studioLocationId: store.studioLocationId || null,
        })),
      },
      include: [{ model: StorefrontCustomer, as: 'storefrontCustomer', attributes: ['id', 'name'], required: false }],
      order: [['createdAt', 'DESC']],
    });
  } catch (error) {
    if (isMissingReviewsTableError(error)) {
      return attachStoresWithoutReviews(stores);
    }
    throw error;
  }
  const reviewsByStoreKey = reviews.reduce((map, review) => {
    const key = `${review.tenantId}:${review.shopId || ''}:${review.studioLocationId || ''}`;
    const current = map.get(key) || [];
    current.push(review);
    map.set(key, current);
    return map;
  }, new Map());

  return stores.map((store) => {
    const plain = typeof store?.get === 'function' ? store.get({ plain: true }) : store;
    const summary = summarizeReviews(
      reviewsByStoreKey.get(`${plain?.tenantId}:${plain?.shopId || ''}:${plain?.studioLocationId || ''}`) || [],
      { includeList: false },
    );
    return {
      ...plain,
      rating: summary.rating,
      reviewsCount: summary.reviewsCount,
      reviewSummary: summary,
    };
  });
};

const resolveListing = async (listingId) => {
  const listing = await OnlineProductListing.findOne({
    where: { id: listingId },
    include: [
      { model: Product, as: 'product', attributes: ['id', 'name', 'isActive'], required: false },
      { model: ProductVariant, as: 'variant', attributes: ['id', 'productId', 'name'], required: false },
    ],
  });
  return listing ? listing.get({ plain: true }) : null;
};

const resolveStore = async (storeSlug) => {
  const store = await OnlineStoreSettings.findOne({
    where: { slug: { [Op.iLike]: compact(storeSlug, 80).toLowerCase() }, enabled: true },
    include: [
      { model: Tenant, as: 'tenant', attributes: ['id', 'name', 'status'], required: true, where: { status: 'active' } },
      { model: Shop, as: 'shop', attributes: ['id', 'name', 'isActive'], required: false, where: { isActive: true } },
    ],
  });
  return store ? store.get({ plain: true }) : null;
};

const saleItemMatchesListing = (item, listing) => (
  item?.metadata?.onlineListingId === listing.id
  || (
    item?.productId === listing.productId
    && (!listing.productVariantId || item?.productVariantId === listing.productVariantId)
  )
);

const getOrderContactCandidates = (order, metadata = getSaleMetadata(order)) => [
  metadata.storefrontCustomerEmail,
  metadata.storefrontCustomerPhone,
  metadata.deliveryAddress?.email,
  metadata.deliveryAddress?.phone,
  order?.customer?.email,
  order?.customer?.phone,
].filter(Boolean);

const getOrderOwnershipDebug = (order, shopper) => {
  const metadata = getSaleMetadata(order);
  const shopperEmail = normalizeEmail(shopper?.email);
  const shopperPhone = normalizePhone(shopper?.phone);
  let emailMatches = false;
  let phoneMatches = false;
  const contactCandidates = getOrderContactCandidates(order, metadata);

  contactCandidates.forEach((candidate) => {
    if (shopperEmail && normalizeEmail(candidate) === shopperEmail) emailMatches = true;
    const candidatePhone = normalizePhone(candidate);
    if (shopperPhone && candidatePhone && candidatePhone === shopperPhone) phoneMatches = true;
  });

  const customerIdMatches = Boolean(
    metadata.storefrontCustomerId
    && String(metadata.storefrontCustomerId) === String(shopper?.id)
  );

  return {
    customerIdMatches,
    emailMatches,
    phoneMatches,
    contactCandidateCount: contactCandidates.length,
    orderStorefrontCustomerId: metadata.storefrontCustomerId || null,
    shopperFound: Boolean(shopper?.id),
    shopperHasEmail: Boolean(shopperEmail),
    shopperHasPhone: Boolean(shopperPhone),
    belongsToShopper: customerIdMatches || emailMatches || phoneMatches,
  };
};

const orderBelongsToShopper = (order, shopper) => {
  const ownership = getOrderOwnershipDebug(order, shopper);
  return ownership.belongsToShopper;
};

const findEligibleOrderForProduct = async ({ customerId, listing, saleId = null }) => {
  const orderWhere = shopperOrderWhere(customerId, {
    ...(saleId ? { id: saleId } : {}),
    tenantId: listing.tenantId,
    ...(!saleId && listing.shopId ? { shopId: listing.shopId } : {}),
  });
  let orders = await Sale.findAll({
    where: orderWhere,
    include: [{ model: SaleItem, as: 'items', required: true }],
    order: [['createdAt', 'DESC']],
  });
  let fallbackUsed = false;

  if (saleId && orders.length === 0) {
    const shopper = toPlain(await StorefrontCustomer.findByPk(customerId, {
      attributes: ['id', 'email', 'phone'],
    }));
    const saleById = toPlain(await Sale.findOne({
      where: { id: saleId },
      include: [{ model: SaleItem, as: 'items', required: false }],
    }));
    const fallbackOrders = await Sale.findAll({
      where: {
        id: saleId,
        tenantId: listing.tenantId,
        [Op.and]: [sequelize.where(saleMetadataJsonKey('source'), ONLINE_STORE_SOURCE)],
      },
      include: [{ model: SaleItem, as: 'items', required: true }],
      order: [['createdAt', 'DESC']],
    });
    orders = fallbackOrders.filter((order) => orderBelongsToShopper(toPlain(order), shopper));
    fallbackUsed = true;

    console.info('[storefront-reviews] product review saleId fallback diagnostics', {
      customerId,
      listingId: listing.id,
      listingTenantId: listing.tenantId,
      listingShopId: listing.shopId || null,
      listingProductId: listing.productId,
      listingProductVariantId: listing.productVariantId || null,
      requestedSaleId: saleId,
      shopperFound: Boolean(shopper?.id),
      shopperHasEmail: Boolean(normalizeEmail(shopper?.email)),
      shopperHasPhone: Boolean(normalizePhone(shopper?.phone)),
      saleFoundById: Boolean(saleById?.id),
      saleTenantId: saleById?.tenantId || null,
      saleShopId: saleById?.shopId || null,
      saleSource: getSaleMetadata(saleById).source || null,
      saleStorefrontCustomerId: getSaleMetadata(saleById).storefrontCustomerId || null,
      saleStatus: saleById?.status || null,
      saleOrderStatus: saleById?.orderStatus || null,
      saleDeliveryStatus: saleById?.deliveryStatus || null,
      saleItemCount: Array.isArray(saleById?.items) ? saleById.items.length : 0,
      saleItems: (saleById?.items || []).map((item) => ({
        saleItemId: item.id,
        productId: item.productId || null,
        productVariantId: item.productVariantId || null,
        onlineListingId: item.metadata?.onlineListingId || null,
        matchesListing: saleItemMatchesListing(item, listing),
      })),
      tenantMatches: Boolean(saleById?.tenantId && String(saleById.tenantId) === String(listing.tenantId)),
      shopMatchesWhenRequired: listing.shopId
        ? String(saleById?.shopId || '') === String(listing.shopId)
        : true,
      itemMatchesListing: (saleById?.items || []).some((item) => saleItemMatchesListing(item, listing)),
      sourceMatches: getSaleMetadata(saleById).source === ONLINE_STORE_SOURCE,
      ownership: saleById ? getOrderOwnershipDebug(saleById, shopper) : null,
      fallbackCandidateCount: fallbackOrders.length,
      fallbackOwnedCount: orders.length,
    });
  }

  const matchingOrders = orders.filter((order) => (
    (order.items || []).some((item) => saleItemMatchesListing(item, listing))
  ));
  const eligibleOrder = matchingOrders.find(isReviewableDeliveredOrder);
  const order = eligibleOrder || matchingOrders[0] || null;
  const saleItem = order?.items?.find((item) => saleItemMatchesListing(item, listing)) || null;
  console.info('[storefront-reviews] product eligible order lookup', {
    customerId,
    listingId: listing.id,
    productId: listing.productId,
    productVariantId: listing.productVariantId || null,
    requestedSaleId: saleId || null,
    fallbackUsed,
    orderCount: orders.length,
    matchingOrderCount: matchingOrders.length,
    selectedSaleId: order?.id || null,
    selectedSaleStatus: order?.status || null,
    selectedOrderStatus: order?.orderStatus || null,
    selectedDeliveryStatus: order?.deliveryStatus || null,
    saleItemId: saleItem?.id || null,
    eligible: Boolean(eligibleOrder),
    reason: reviewBlockedReason(order),
  });
  return { order, saleItem, eligible: Boolean(eligibleOrder), reason: reviewBlockedReason(order) };
};

const findEligibleOrderForStore = async ({ customerId, store, saleId = null }) => {
  const orders = await Sale.findAll({
    where: shopperOrderWhere(customerId, {
      ...(saleId ? { id: saleId } : {}),
      tenantId: store.tenantId,
      shopId: store.shopId || null,
    }),
    include: [{ model: SaleItem, as: 'items', required: false }],
    order: [['createdAt', 'DESC']],
  });
  const eligibleOrder = orders.find(isReviewableDeliveredOrder);
  const order = eligibleOrder || orders[0] || null;
  return { order, saleItem: null, eligible: Boolean(eligibleOrder), reason: reviewBlockedReason(order) };
};

const existingReviewWhere = ({ reviewType, customerId, order, listing, store }) => {
  if (reviewType === 'product') {
    return {
      reviewType: 'product',
      storefrontCustomerId: customerId,
      saleId: order.id,
      productId: listing.productId,
      status: { [Op.ne]: 'removed' },
    };
  }
  return {
    reviewType: 'store',
    storefrontCustomerId: customerId,
    saleId: order.id,
    tenantId: store.tenantId,
    shopId: store.shopId || null,
    status: { [Op.ne]: 'removed' },
  };
};

const buildEligibilityResponse = async ({ reviewType, customerId, listingId, storeSlug, saleId = null }) => {
  const listing = reviewType === 'product' ? await resolveListing(listingId) : null;
  const store = reviewType === 'store' ? await resolveStore(storeSlug) : null;
  if (reviewType === 'product' && !listing) {
    return { eligible: false, reason: 'Product listing was not found.', target: null, existingReview: null };
  }
  if (reviewType === 'store' && !store) {
    return { eligible: false, reason: 'Store was not found or is not available.', target: null, existingReview: null };
  }

  const result = reviewType === 'product'
    ? await findEligibleOrderForProduct({ customerId, listing, saleId })
    : await findEligibleOrderForStore({ customerId, store, saleId });

  const existingReview = result.order
    ? await StorefrontReview.findOne({ where: existingReviewWhere({ reviewType, customerId, order: result.order, listing, store }) })
    : null;

  console.info('[storefront-reviews] eligibility built', {
    reviewType,
    customerId,
    listingId: listing?.id || null,
    storeSlug: store?.slug || null,
    requestedSaleId: saleId || null,
    selectedSaleId: result.order?.id || null,
    saleItemId: result.saleItem?.id || null,
    eligible: result.eligible === true,
    reason: result.eligible ? null : result.reason,
    existingReviewId: existingReview?.id || null,
  });

  return {
    eligible: result.eligible,
    reason: result.eligible ? null : result.reason,
    saleId: result.order?.id || null,
    saleItemId: result.saleItem?.id || null,
    existingReview: serializeReview(existingReview),
    target: reviewType === 'product'
      ? {
        reviewType,
        listingId: listing.id,
        productId: listing.productId,
        productVariantId: listing.productVariantId || null,
        title: listing.title,
      }
      : {
        reviewType,
        storeSlug: store.slug,
        tenantId: store.tenantId,
        shopId: store.shopId || null,
        displayName: store.displayName,
      },
  };
};

const CONFIRMATION_RATING_KEYS = ['productQuality', 'valueForMoney', 'packaging', 'deliveryExperience'];

const parseReviewPayload = (payload = {}) => {
  const rating = Number.parseInt(payload.rating, 10);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    const error = new Error('Choose a rating from 1 to 5 stars.');
    error.status = 400;
    throw error;
  }
  const comment = compact(payload.comment || payload.text || '', REVIEW_COMMENT_MAX_LENGTH);
  const title = compact(payload.title || '', REVIEW_TITLE_MAX_LENGTH);
  return {
    rating,
    comment: comment || null,
    title: title || null,
  };
};

const parseConfirmationRating = (value) => {
  const rating = Number.parseInt(value, 10);
  return Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : null;
};

const computeOverallConfirmationRating = (ratings = {}) => {
  const values = CONFIRMATION_RATING_KEYS.map((key) => ratings[key]).filter((value) => value != null);
  if (!values.length) return null;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.min(5, Math.max(1, Math.round(average)));
};

const parseConfirmationReviewPayload = (body = {}) => {
  const confirmations = {
    receivedOrder: body?.confirmations?.receivedOrder === true || body?.receivedOrder === true,
    itemsMatchOrder: body?.confirmations?.itemsMatchOrder === true || body?.itemsMatchOrder === true,
  };
  if (!confirmations.receivedOrder || !confirmations.itemsMatchOrder) {
    const error = new Error('Confirm that you received the order and that the items match what you ordered.');
    error.status = 400;
    error.code = 'CONFIRMATION_REQUIRED';
    throw error;
  }

  const rawRatings = body?.ratings && typeof body.ratings === 'object' ? body.ratings : {};
  const ratings = {};
  let ratedCount = 0;
  CONFIRMATION_RATING_KEYS.forEach((key) => {
    const parsed = parseConfirmationRating(rawRatings[key]);
    if (parsed) {
      ratings[key] = parsed;
      ratedCount += 1;
    }
  });

  if (ratedCount > 0 && ratedCount < CONFIRMATION_RATING_KEYS.length) {
    const error = new Error('Rate product quality, value for money, packaging, and delivery experience from 1 to 5 stars.');
    error.status = 400;
    error.code = 'INCOMPLETE_REVIEW_RATINGS';
    throw error;
  }

  const comment = compact(body?.comment || body?.reviewComment || '', REVIEW_COMMENT_MAX_LENGTH);
  return {
    confirmations,
    ratings: ratedCount ? ratings : null,
    comment: comment || null,
    overallRating: ratedCount ? computeOverallConfirmationRating(ratings) : null,
  };
};

const upsertVerifiedReviewRecord = async ({
  reviewType,
  customerId,
  order,
  listing = null,
  store = null,
  saleItem = null,
  reviewPayload,
  reviewMetadata = {},
  transaction = null,
}) => {
  const where = existingReviewWhere({ reviewType, customerId, order, listing, store });
  const defaults = {
    reviewType,
    storefrontCustomerId: customerId,
    tenantId: order.tenantId,
    shopId: order.shopId || null,
    listingId: listing?.id || null,
    productId: listing?.productId || saleItem?.productId || null,
    productVariantId: listing?.productVariantId || saleItem?.productVariantId || null,
    saleId: order.id,
    saleItemId: saleItem?.id || null,
    status: 'published',
    verifiedAt: new Date(),
    metadata: {
      source: 'storefront_confirm_received',
      saleNumber: order.saleNumber,
      confirmedReceivedAt: getSaleMetadata(order).confirmedReceivedAt || null,
      ...reviewMetadata,
    },
    ...reviewPayload,
  };

  const [review, created] = await StorefrontReview.findOrCreate({
    where,
    defaults,
    transaction,
  });
  if (!created) {
    await review.update({
      ...reviewPayload,
      status: 'published',
      verifiedAt: review.verifiedAt || new Date(),
      metadata: {
        ...(review.metadata || {}),
        ...defaults.metadata,
        updatedFrom: 'storefront_confirm_received',
      },
    }, { transaction });
  }

  return review;
};

const createVerifiedReviewsFromConfirmation = async ({
  customerId,
  order,
  payload,
  transaction = null,
}) => {
  const plain = typeof order?.get === 'function' ? order.get({ plain: true }) : order;
  if (!payload?.overallRating) return { storeReview: null, productReviews: [] };

  const metadata = getSaleMetadata(plain);
  const reviewPayload = {
    rating: payload.overallRating,
    comment: payload.comment,
    title: null,
  };
  const reviewMetadata = {
    dimensions: payload.ratings,
    confirmations: payload.confirmations,
  };

  const results = { storeReview: null, productReviews: [] };
  if (metadata.storeSlug) {
    const store = await resolveStore(metadata.storeSlug);
    if (store) {
      results.storeReview = await upsertVerifiedReviewRecord({
        reviewType: 'store',
        customerId,
        order: plain,
        store,
        reviewPayload,
        reviewMetadata,
        transaction,
      });
    }
  }

  const items = plain.items || [];
  for (const item of items) {
    const listingId = item?.metadata?.onlineListingId;
    if (!listingId || !item?.productId) continue;
    const listing = await resolveListing(listingId);
    if (!listing) continue;
    const productReview = await upsertVerifiedReviewRecord({
      reviewType: 'product',
      customerId,
      order: plain,
      listing,
      saleItem: item,
      reviewPayload,
      reviewMetadata,
      transaction,
    });
    results.productReviews.push(productReview);
  }

  return results;
};

const createOrUpdateVerifiedReview = async ({ reviewType, customerId, listingId, storeSlug, payload }) => {
  const saleId = compact(payload?.saleId, 80) || null;
  const eligibility = await buildEligibilityResponse({ reviewType, customerId, listingId, storeSlug, saleId });
  if (!eligibility.eligible) {
    const error = new Error(eligibility.reason || 'You are not eligible to review this purchase yet.');
    error.status = 403;
    error.code = 'REVIEW_NOT_ELIGIBLE';
    throw error;
  }

  const reviewPayload = parseReviewPayload(payload);
  const listing = reviewType === 'product' ? await resolveListing(eligibility.target.listingId) : null;
  const store = reviewType === 'store' ? await resolveStore(eligibility.target.storeSlug) : null;
  const order = await Sale.findByPk(eligibility.saleId);
  const saleItem = eligibility.saleItemId ? await SaleItem.findByPk(eligibility.saleItemId) : null;
  const where = existingReviewWhere({ reviewType, customerId, order, listing, store });
  const defaults = {
    reviewType,
    storefrontCustomerId: customerId,
    tenantId: order.tenantId,
    shopId: order.shopId || null,
    listingId: listing?.id || null,
    productId: listing?.productId || null,
    productVariantId: listing?.productVariantId || null,
    saleId: order.id,
    saleItemId: saleItem?.id || null,
    status: 'published',
    verifiedAt: new Date(),
    metadata: {
      source: 'storefront_verified_purchase',
      saleNumber: order.saleNumber,
      confirmedReceivedAt: getSaleMetadata(order).confirmedReceivedAt || null,
    },
    ...reviewPayload,
  };

  const [review, created] = await StorefrontReview.findOrCreate({ where, defaults });
  if (!created) {
    await review.update({
      ...reviewPayload,
      status: 'published',
      verifiedAt: review.verifiedAt || new Date(),
      metadata: {
        ...(review.metadata || {}),
        updatedFrom: 'storefront_verified_purchase',
      },
    });
  }

  const refreshed = await StorefrontReview.findByPk(review.id, {
    include: [{ model: StorefrontCustomer, as: 'storefrontCustomer', attributes: ['id', 'name'], required: false }],
  });
  return { review: serializeReview(refreshed), created };
};

const updateOwnReview = async ({ customerId, reviewId, payload }) => {
  const review = await StorefrontReview.findOne({
    where: { id: reviewId, storefrontCustomerId: customerId, status: { [Op.ne]: 'removed' } },
  });
  if (!review) {
    const error = new Error('Review not found.');
    error.status = 404;
    throw error;
  }
  const reviewPayload = parseReviewPayload(payload);
  await review.update(reviewPayload);
  const refreshed = await StorefrontReview.findByPk(review.id, {
    include: [{ model: StorefrontCustomer, as: 'storefrontCustomer', attributes: ['id', 'name'], required: false }],
  });
  return { review: serializeReview(refreshed) };
};

const getOrderReviewActions = async (order) => {
  const plain = typeof order?.get === 'function' ? order.get({ plain: true }) : order;
  const metadata = getSaleMetadata(plain);
  const customerId = metadata.storefrontCustomerId;
  const canReviewOrder = isReviewableDeliveredOrder(plain);
  if (!customerId) {
    return { eligible: false, reason: 'This order is not linked to a shopper account.', store: null, products: [] };
  }

  const existingReviews = await StorefrontReview.findAll({
    where: {
      storefrontCustomerId: customerId,
      saleId: plain.id,
      status: { [Op.ne]: 'removed' },
    },
  });
  const productReviewsByProductId = new Map(
    existingReviews
      .filter((review) => review.reviewType === 'product')
      .map((review) => [review.productId, review])
  );
  const storeReview = existingReviews.find((review) => review.reviewType === 'store') || null;
  const reason = canReviewOrder ? null : reviewBlockedReason(plain);

  return {
    eligible: canReviewOrder,
    reason,
    store: {
      canReview: canReviewOrder && !storeReview,
      reviewId: storeReview?.id || null,
      reviewed: Boolean(storeReview),
      storeSlug: metadata.storeSlug || null,
      saleId: plain.id,
    },
    products: (plain.items || []).map((item) => {
      const review = productReviewsByProductId.get(item.productId) || null;
      return {
        saleItemId: item.id,
        listingId: item.metadata?.onlineListingId || null,
        productId: item.productId || null,
        productVariantId: item.productVariantId || null,
        name: item.name,
        canReview: canReviewOrder && Boolean(item.productId) && !review,
        reviewed: Boolean(review),
        reviewId: review?.id || null,
        saleId: plain.id,
      };
    }),
  };
};

const attachServiceReviewSummaries = async (services = []) => {
  const listingIds = [...new Set(services.map((service) => service?.id).filter(Boolean))];
  if (!listingIds.length) return services;

  let reviews;
  try {
    reviews = await StorefrontReview.findAll({
      where: {
        reviewType: 'service',
        serviceListingId: { [Op.in]: listingIds },
        status: 'published',
      },
      include: [{ model: StorefrontCustomer, as: 'storefrontCustomer', attributes: ['id', 'name'], required: false }],
      order: [['createdAt', 'DESC']],
    });
  } catch (error) {
    if (isMissingReviewsTableError(error)) {
      return services.map((service) => ({
        ...service,
        rating: DEFAULT_SUMMARY.rating,
        reviewsCount: DEFAULT_SUMMARY.reviewsCount,
        reviewSummary: { ...DEFAULT_SUMMARY },
      }));
    }
    throw error;
  }

  const reviewsByListingId = reviews.reduce((map, review) => {
    const current = map.get(review.serviceListingId) || [];
    current.push(review);
    map.set(review.serviceListingId, current);
    return map;
  }, new Map());

  return services.map((service) => {
    const summary = summarizeReviews(reviewsByListingId.get(service.id) || [], { includeList: false });
    return {
      ...service,
      rating: summary.rating,
      reviewsCount: summary.reviewsCount,
      reviewSummary: summary,
    };
  });
};

const resolveServiceListing = async (listingId) => {
  const listing = await OnlineServiceListing.findOne({
    where: { id: listingId, status: 'published' },
  });
  return listing ? listing.get({ plain: true }) : null;
};

const metadataJsonEquals = (alias, key, value) => sequelize.where(
  sequelize.literal(`"${alias}"."metadata"->>'${key}'`),
  String(value),
);

const findCompletedMarketplaceJobForService = async (customerId, listing) => {
  const leads = await Lead.findAll({
    where: {
      tenantId: listing.tenantId,
      convertedJobId: { [Op.ne]: null },
      [Op.and]: [
        metadataJsonEquals('Lead', 'storefrontCustomerId', customerId),
        metadataJsonEquals('Lead', 'serviceListingId', listing.id),
      ],
    },
    attributes: ['convertedJobId'],
    limit: 10,
  });
  const jobIds = leads.map((lead) => lead.convertedJobId).filter(Boolean);
  if (!jobIds.length) {
    const jobs = await Job.findAll({
      where: {
        tenantId: listing.tenantId,
        status: 'completed',
        [Op.and]: [
          metadataJsonEquals('Job', 'storefrontCustomerId', customerId),
          metadataJsonEquals('Job', 'serviceListingId', listing.id),
        ],
      },
      attributes: ['id', 'status', 'viewToken'],
      limit: 1,
      order: [['updatedAt', 'DESC']],
    });
    return jobs[0] || null;
  }
  return Job.findOne({
    where: {
      id: { [Op.in]: jobIds },
      status: 'completed',
    },
    attributes: ['id', 'status', 'viewToken'],
    order: [['updatedAt', 'DESC']],
  });
};

const getServiceReviewEligibility = async (customerId, listingId) => {
  const listing = await resolveServiceListing(listingId);
  if (!listing) {
    return { eligible: false, reason: 'Service not found.', target: null, jobId: null };
  }

  const existingReview = await StorefrontReview.findOne({
    where: {
      reviewType: 'service',
      storefrontCustomerId: customerId,
      serviceListingId: listing.id,
      status: { [Op.ne]: 'removed' },
    },
  });
  if (existingReview) {
    return {
      eligible: false,
      reason: 'You already reviewed this service.',
      target: { listingId: listing.id },
      jobId: existingReview.jobId,
      reviewId: existingReview.id,
    };
  }

  const job = await findCompletedMarketplaceJobForService(customerId, listing);
  if (!job) {
    return {
      eligible: false,
      reason: 'You can review after the studio completes your service.',
      target: { listingId: listing.id },
      jobId: null,
    };
  }

  return {
    eligible: true,
    reason: null,
    target: { listingId: listing.id },
    jobId: job.id,
    trackingToken: job.viewToken || null,
  };
};

const listPublicServiceReviews = async (listingId, query = {}) => {
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 20, 1), 50);
  const summary = await getPublicReviewSummary({
    reviewType: 'service',
    serviceListingId: listingId,
    limit,
  });
  return summary;
};

const createOrUpdateServiceReview = async (shopper, listingId, payload) => {
  const eligibility = await getServiceReviewEligibility(shopper.id, listingId);
  if (!eligibility.eligible) {
    const error = new Error(eligibility.reason || 'You are not eligible to review this service yet.');
    error.status = 403;
    error.code = 'REVIEW_NOT_ELIGIBLE';
    throw error;
  }

  const listing = await resolveServiceListing(listingId);
  const reviewPayload = parseReviewPayload(payload);
  const where = {
    reviewType: 'service',
    storefrontCustomerId: shopper.id,
    serviceListingId: listing.id,
    jobId: eligibility.jobId,
    status: { [Op.ne]: 'removed' },
  };
  const defaults = {
    reviewType: 'service',
    storefrontCustomerId: shopper.id,
    tenantId: listing.tenantId,
    studioLocationId: listing.studioLocationId || null,
    serviceListingId: listing.id,
    jobId: eligibility.jobId,
    saleId: null,
    status: 'published',
    verifiedAt: new Date(),
    metadata: {
      source: 'storefront_verified_service',
      trackingToken: eligibility.trackingToken || null,
    },
    ...reviewPayload,
  };

  const [review, created] = await StorefrontReview.findOrCreate({ where, defaults });
  if (!created) {
    await review.update({
      ...reviewPayload,
      status: 'published',
      verifiedAt: review.verifiedAt || new Date(),
      metadata: {
        ...(review.metadata || {}),
        updatedFrom: 'storefront_verified_service',
      },
    });
  }

  const refreshed = await StorefrontReview.findByPk(review.id, {
    include: [{ model: StorefrontCustomer, as: 'storefrontCustomer', attributes: ['id', 'name'], required: false }],
  });
  return { review: serializeReview(refreshed), created };
};

module.exports = {
  attachProductReviewSummaries,
  attachServiceReviewSummaries,
  attachStoreReviewSummaries,
  createOrUpdateServiceReview,
  getServiceReviewEligibility,
  listPublicServiceReviews,
  buildEligibilityResponse,
  computeOverallConfirmationRating,
  createOrUpdateVerifiedReview,
  createVerifiedReviewsFromConfirmation,
  getOrderReviewActions,
  getPublicReviewSummary,
  isReviewableDeliveredOrder,
  parseConfirmationReviewPayload,
  serializeReview,
  updateOwnReview,
};
