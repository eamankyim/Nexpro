const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const {
  OnlineStoreSettings,
  OnlineProductListing,
  Sale,
  SaleItem,
  SaleActivity,
  Customer,
  Product,
  ProductVariant,
  Shop,
} = require('../models');
const { baseUploadDir, ensureDirExists } = require('../middleware/upload');
const { applyTenantFilter } = require('../utils/tenantUtils');
const { getPagination } = require('../utils/paginationUtils');
const { applyShopReadFilter, attachShopToPayload, assertShopIdAccess } = require('../utils/shopUtils');
const { invalidateSaleListCache } = require('../middleware/cache');

const DEFAULT_PRIMARY_COLOR = '#166534';
const DEFAULT_CURRENCY = 'GHS';
const LISTING_STATUSES = new Set(['draft', 'published', 'hidden']);
const INVENTORY_POLICIES = new Set(['track', 'continue', 'deny']);
const ONLINE_STORE_SOURCE = 'online_store';
const ORDER_STATUS_FILTERS = new Set(['pending', 'paid', 'processing', 'out_for_delivery', 'delivered', 'cancelled']);
const STORE_ORDER_STATUS_ACTIONS = new Set(['processing', 'ready', 'out_for_delivery', 'delivered', 'cancelled']);

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

const storeWhereForRequest = (req, extra = {}) => {
  const query = req.query || {};
  let where = applyTenantFilter(req.tenantId, extra);
  if (req.shopScoped) {
    where = applyShopReadFilter(req, where);
  } else if (query.shopId) {
    where.shopId = query.shopId;
  }
  return where;
};

const addAndCondition = (where, condition) => {
  where[Op.and] = Array.isArray(where[Op.and])
    ? [...where[Op.and], condition]
    : (where[Op.and] ? [where[Op.and], condition] : [condition]);
  return where;
};

const onlineOrderSourceCondition = () => sequelize.where(sequelize.json('metadata.source'), ONLINE_STORE_SOURCE);

const applyOnlineOrderStatusFilter = (where, status) => {
  if (!status || status === 'all' || !ORDER_STATUS_FILTERS.has(status)) return where;

  if (status === 'pending') {
    where.status = { [Op.in]: ['pending', 'partially_paid'] };
    return where;
  }
  if (status === 'paid') {
    where.status = 'completed';
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
    [Op.or]: [
      { deliveryStatus: null },
      { orderStatus: { [Op.in]: ['received', 'preparing', 'processing'] } },
    ],
  });
  return where;
};

const buildOnlineOrderWhere = (req, { includeStatus = true } = {}) => {
  const where = storeWhereForRequest(req);
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

  const [
    total,
    pendingPayment,
    paid,
    processing,
    outForDelivery,
    delivered,
    cancelled,
    todayOrders,
    todayRevenue,
  ] = await Promise.all([
    countOnlineOrders(req),
    countOnlineOrders(req, { status: { [Op.in]: ['pending', 'partially_paid'] } }),
    countOnlineOrders(req, { status: 'completed' }),
    Sale.count({
      where: applyOnlineOrderStatusFilter(buildOnlineOrderWhere(req, { includeStatus: false }), 'processing'),
      include: [{ model: Customer, as: 'customer', attributes: [], required: false }],
    }),
    countOnlineOrders(req, { deliveryStatus: 'out_for_delivery', status: { [Op.notIn]: ['cancelled', 'refunded'] } }),
    Sale.count({
      where: applyOnlineOrderStatusFilter(buildOnlineOrderWhere(req, { includeStatus: false }), 'delivered'),
      include: [{ model: Customer, as: 'customer', attributes: [], required: false }],
    }),
    countOnlineOrders(req, { status: { [Op.in]: ['cancelled', 'refunded'] } }),
    Sale.count({ where: todayWhere, include: [{ model: Customer, as: 'customer', attributes: [], required: false }] }),
    Sale.sum('total', {
      where: todayWhere,
      include: [{ model: Customer, as: 'customer', attributes: [], required: false }],
    }),
  ]);

  return {
    total: Number(total || 0),
    pendingPayment: Number(pendingPayment || 0),
    paid: Number(paid || 0),
    processing: Number(processing || 0),
    outForDelivery: Number(outForDelivery || 0),
    delivered: Number(delivered || 0),
    cancelled: Number(cancelled || 0),
    todayOrders: Number(todayOrders || 0),
    todayRevenue: Number(todayRevenue || 0),
  };
};

const fulfillmentUpdateForAction = (action) => {
  switch (action) {
    case 'processing':
      return { orderStatus: 'preparing', deliveryStatus: null };
    case 'ready':
      return { orderStatus: 'ready', deliveryStatus: 'ready_for_delivery' };
    case 'out_for_delivery':
      return { orderStatus: 'ready', deliveryStatus: 'out_for_delivery' };
    case 'delivered':
      return { orderStatus: 'completed', deliveryStatus: 'delivered' };
    case 'cancelled':
      return { status: 'cancelled', orderStatus: 'cancelled', deliveryStatus: null };
    default:
      return null;
  }
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

const buildSetupChecklist = async (settings, tenantId) => {
  const listingsCount = await OnlineProductListing.count({
    where: { tenantId, status: 'published' },
  });
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
  const brandingReady = Boolean(settings?.primaryColor);
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
    publishedListingWarning: listingsCount < 1,
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
    res.status(200).json({ success: true, data: settings });
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
      primaryColor: req.body.primaryColor || DEFAULT_PRIMARY_COLOR,
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
        paymentMethods: incomingMetadata.paymentMethods || existingMetadata.paymentMethods || {},
        deliveryOptions: incomingMetadata.deliveryOptions || existingMetadata.deliveryOptions || {},
        setupProgress: incomingMetadata.setupProgress || existingMetadata.setupProgress || {},
      },
    };

    attachShopToPayload(req, payload);
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
    const checklist = await buildSetupChecklist(settings, req.tenantId);
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

exports.getStoreOrders = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
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

    res.status(200).json({
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
  } catch (error) {
    next(error);
  }
};

exports.getStoreOrderStats = async (req, res, next) => {
  try {
    const stats = await getOnlineOrderStats(req);
    res.status(200).json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
};

exports.getStoreOrder = async (req, res, next) => {
  try {
    const where = storeWhereForRequest(req, { id: req.params.id });
    addAndCondition(where, onlineOrderSourceCondition());

    const order = await Sale.findOne({
      where,
      include: storeOrderInclude,
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Online order not found' });
    }

    res.status(200).json({ success: true, data: order });
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
        message: 'Invalid status. Use one of: processing, ready, out_for_delivery, delivered, cancelled',
      });
    }

    const where = storeWhereForRequest(req, { id: req.params.id });
    addAndCondition(where, onlineOrderSourceCondition());

    const order = await Sale.findOne({
      where,
      include: [{ model: Customer, as: 'customer', attributes: ['id', 'name', 'phone', 'email'], required: false }],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!order) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Online order not found' });
    }

    if (['cancelled', 'refunded'].includes(order.status)) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Cancelled or refunded orders cannot be updated' });
    }

    const updateData = fulfillmentUpdateForAction(action);
    const previous = {
      status: order.status,
      orderStatus: order.orderStatus || null,
      deliveryStatus: order.deliveryStatus || null,
    };

    if (action === 'cancelled') {
      await restoreSaleItemStock(order.id, transaction);
    }

    await order.update(updateData, { transaction });
    await SaleActivity.create({
      saleId: order.id,
      tenantId: req.tenantId,
      type: action === 'cancelled' ? 'status_change' : 'note',
      subject: 'Online order status updated',
      notes: `Online order marked ${action.replace(/_/g, ' ')}`,
      createdBy: req.user?.id || null,
      metadata: {
        source: ONLINE_STORE_SOURCE,
        action,
        previous,
        next: updateData,
      },
    }, { transaction });

    await transaction.commit();
    invalidateSaleListCache(req.tenantId);

    const updatedOrder = await Sale.findOne({
      where: { id: order.id, tenantId: req.tenantId },
      include: storeOrderInclude,
    });

    res.status(200).json({ success: true, data: updatedOrder });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
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
      where: { slug: { [Op.iLike]: normalizeSlug(req.params.slug) }, enabled: true },
      attributes: ['tenantId', 'shopId', 'currency'],
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
      order: [['sortOrder', 'ASC'], ['publishedAt', 'DESC']],
    });
    res.status(200).json({ success: true, data: listings, currency: store.currency });
  } catch (error) {
    next(error);
  }
};
