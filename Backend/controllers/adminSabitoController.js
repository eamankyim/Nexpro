const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { getPagination } = require('../utils/paginationUtils');
const {
  Customer,
  MarketplaceDispute,
  MarketplaceLedgerEntry,
  MarketplaceOrderPayment,
  MarketplacePayout,
  OnlineStoreSettings,
  Product,
  ProductVariant,
  Sale,
  SaleItem,
  Shop,
  StorefrontCustomer,
  Tenant,
} = require('../models');
const {
  getAutoReleaseHours,
  getCommissionFixedAmount,
  getCommissionPercent,
  releaseMarketplaceOrderPayment,
} = require('../services/tradeAssuranceService');
const {
  fulfillmentStateForOrder,
  paymentStatusForMarketplaceOrder,
} = require('../utils/marketplaceOrderStatus');

const ONLINE_STORE_SOURCE = 'online_store';
const OPEN_DISPUTE_STATUSES = ['open', 'under_review'];

const money = (value) => Number((Number.parseFloat(value || 0) || 0).toFixed(2));

const parseDate = (value) => {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date : null;
};

const getStartOfToday = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

const onlineOrderWhere = (extra = {}) => ({
  metadata: { [Op.contains]: { source: ONLINE_STORE_SOURCE } },
  ...extra,
});

const buildStoreSearchWhere = (search) => {
  if (!search) return {};
  const term = `%${String(search).trim()}%`;
  return {
    [Op.or]: [
      { slug: { [Op.iLike]: term } },
      { displayName: { [Op.iLike]: term } },
      { contactEmail: { [Op.iLike]: term } },
      { '$tenant.name$': { [Op.iLike]: term } },
      { '$shop.name$': { [Op.iLike]: term } },
    ],
  };
};

const buildOrderSearchWhere = (search) => {
  if (!search) return {};
  const term = `%${String(search).trim()}%`;
  return {
    [Op.or]: [
      { saleNumber: { [Op.iLike]: term } },
      { '$tenant.name$': { [Op.iLike]: term } },
      { '$shop.name$': { [Op.iLike]: term } },
      { '$customer.name$': { [Op.iLike]: term } },
      { '$customer.email$': { [Op.iLike]: term } },
    ],
  };
};

const buildCustomerSearchWhere = (search) => {
  if (!search) return {};
  const term = `%${String(search).trim()}%`;
  return {
    [Op.or]: [
      { name: { [Op.iLike]: term } },
      { email: { [Op.iLike]: term } },
      { phone: { [Op.iLike]: term } },
    ],
  };
};

const serializeStore = async (store) => {
  const plain = store.get({ plain: true });
  const [orderCount, heldPaymentCount, openDisputeCount] = await Promise.all([
    Sale.count({ where: onlineOrderWhere({ tenantId: plain.tenantId, shopId: plain.shopId || null }) }),
    MarketplaceOrderPayment.count({ where: { tenantId: plain.tenantId, shopId: plain.shopId || null, status: 'paid_held' } }),
    MarketplaceDispute.count({
      where: { tenantId: plain.tenantId, shopId: plain.shopId || null, status: { [Op.in]: OPEN_DISPUTE_STATUSES } },
    }),
  ]);

  return {
    id: plain.id,
    tenantId: plain.tenantId,
    shopId: plain.shopId,
    slug: plain.slug,
    displayName: plain.displayName,
    enabled: plain.enabled,
    setupCompletedAt: plain.setupCompletedAt,
    contactEmail: plain.contactEmail,
    contactPhone: plain.contactPhone,
    currency: plain.currency,
    deliveryEnabled: plain.deliveryEnabled,
    pickupEnabled: plain.pickupEnabled,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
    tenant: plain.tenant,
    shop: plain.shop,
    metrics: {
      orderCount,
      heldPaymentCount,
      openDisputeCount,
    },
  };
};

const serializeOrder = (order) => {
  const plain = order.get({ plain: true });
  const metadata = plain.metadata && typeof plain.metadata === 'object' ? plain.metadata : {};
  const payment = plain.marketplacePayment || null;

  const paymentStatus = paymentStatusForMarketplaceOrder(plain);
  const fulfillmentStatus = fulfillmentStateForOrder(plain);

  return {
    id: plain.id,
    saleNumber: plain.saleNumber,
    tenantId: plain.tenantId,
    shopId: plain.shopId,
    subtotal: money(plain.subtotal),
    deliveryFee: money(plain.deliveryFee),
    total: money(plain.total),
    status: plain.status,
    orderStatus: plain.orderStatus,
    deliveryStatus: plain.deliveryStatus,
    paymentStatus,
    fulfillmentStatus,
    fulfillmentMethod: metadata.fulfillmentMethod || (plain.deliveryRequired ? 'delivery' : 'pickup'),
    createdAt: plain.createdAt,
    tenant: plain.tenant,
    shop: plain.shop,
    customer: plain.customer,
    storefrontCustomer: payment?.storefrontCustomer || null,
    tradeAssurance: payment ? {
      id: payment.id,
      status: payment.status,
      paymentStatus: payment.status,
      currency: payment.currency,
      grossAmount: money(payment.grossAmount),
      feeAmount: money(payment.feeAmount),
      netAmount: money(payment.netAmount),
      refundedAmount: money(payment.refundedAmount),
      heldAt: payment.heldAt,
      releaseEligibleAt: payment.releaseEligibleAt,
      releasedAt: payment.releasedAt,
    } : (metadata.tradeAssurance ? {
      ...metadata.tradeAssurance,
      status: metadata.tradeAssurance.paymentStatus || metadata.tradeAssurance.status || null,
      paymentStatus: metadata.tradeAssurance.paymentStatus || metadata.tradeAssurance.status || null,
    } : null),
  };
};

const addActivity = (items, type, label, at, meta = {}) => {
  if (!at) return;
  items.push({ type, label, at, ...meta });
};

const serializeOrderDetail = (order) => {
  const plain = order.get({ plain: true });
  const metadata = plain.metadata && typeof plain.metadata === 'object' ? plain.metadata : {};
  const deliveryTracking = metadata.deliveryTracking && typeof metadata.deliveryTracking === 'object'
    ? metadata.deliveryTracking
    : {};
  const deliveryAddress = metadata.deliveryAddress && typeof metadata.deliveryAddress === 'object'
    ? metadata.deliveryAddress
    : null;
  const base = serializeOrder(order);
  const payment = plain.marketplacePayment || null;
  const activity = [];

  addActivity(activity, 'order', 'Order placed', plain.createdAt);
  addActivity(activity, 'payment', 'Payment held in trade assurance', payment?.heldAt || metadata.tradeAssurance?.heldAt);
  addActivity(activity, 'fulfillment', 'Seller marked delivered', plain.deliveredAt || deliveryTracking.deliveredAt);
  addActivity(activity, 'fulfillment', 'Customer confirmed receipt', metadata.confirmedReceivedAt);
  addActivity(activity, 'payment', 'Payout became eligible', payment?.releaseEligibleAt || metadata.tradeAssurance?.payoutReleaseEligibleAt);
  addActivity(activity, 'payment', 'Payout released from hold', payment?.releasedAt || metadata.tradeAssurance?.payoutReleasedAt);
  addActivity(activity, 'payment', 'Payout transferred to seller', metadata.tradeAssurance?.payoutPaidOutAt);

  if (Array.isArray(deliveryTracking.history)) {
    deliveryTracking.history.forEach((entry) => {
      if (entry && typeof entry === 'object') {
        addActivity(
          activity,
          'fulfillment',
          entry.label || entry.status || 'Delivery update',
          entry.at || entry.createdAt,
          { status: entry.status || null }
        );
      }
    });
  }

  return {
    ...base,
    discount: money(plain.discount),
    tax: money(plain.tax),
    amountPaid: money(plain.amountPaid),
    paymentMethod: plain.paymentMethod,
    notes: plain.notes || '',
    updatedAt: plain.updatedAt,
    currency: payment?.currency || metadata.currency || base.tradeAssurance?.currency || 'GHS',
    store: {
      name: plain.shop?.name || metadata.storeName || metadata.storeSlug || plain.tenant?.name || 'Marketplace',
      slug: metadata.storeSlug || null,
      tenantName: plain.tenant?.name || null,
    },
    shopper: {
      name: base.storefrontCustomer?.name || plain.customer?.name || metadata.storefrontCustomerName || 'Guest shopper',
      email: base.storefrontCustomer?.email || plain.customer?.email || metadata.storefrontCustomerEmail || deliveryAddress?.email || null,
      phone: base.storefrontCustomer?.phone || plain.customer?.phone || metadata.storefrontCustomerPhone || deliveryAddress?.phone || null,
    },
    delivery: {
      required: plain.deliveryRequired === true,
      method: base.fulfillmentMethod,
      status: plain.deliveryStatus || deliveryTracking.currentStatus || null,
      address: deliveryAddress,
      courier: deliveryTracking.courier || metadata.delivery?.courier || null,
      trackingNumber: deliveryTracking.trackingNumber || metadata.delivery?.trackingNumber || null,
      notes: deliveryTracking.notes || metadata.delivery?.notes || null,
      deliveredAt: plain.deliveredAt || deliveryTracking.deliveredAt || null,
    },
    items: (plain.items || []).map((item) => ({
      id: item.id,
      name: item.name,
      sku: item.sku || item.variant?.sku || null,
      quantity: Number(item.quantity || 0),
      unitPrice: money(item.unitPrice),
      discount: money(item.discount),
      tax: money(item.tax),
      subtotal: money(item.subtotal),
      total: money(item.total),
      productId: item.productId,
      productVariantId: item.productVariantId,
      variantName: item.variant?.name || null,
      imageUrl: item.metadata?.imageUrl || item.product?.imageUrl || null,
    })),
    activity: activity.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()),
  };
};

const getLedgerBalances = async () => {
  const entries = await MarketplaceLedgerEntry.findAll({
    attributes: ['balanceType', 'direction', 'amount', 'currency'],
    order: [['createdAt', 'ASC']],
  });

  return entries.reduce((balances, entry) => {
    const plain = entry.get({ plain: true });
    const signedAmount = plain.direction === 'debit' ? -money(plain.amount) : money(plain.amount);
    balances[plain.balanceType] = money((balances[plain.balanceType] || 0) + signedAmount);
    balances.currency = balances.currency || plain.currency || 'GHS';
    return balances;
  }, { pending: 0, available: 0, paid_out: 0, fee: 0, refunded: 0, currency: 'GHS' });
};

const getGlobalTradeAssuranceSummary = async () => {
  const [ledgerBalances, payments, openDisputes, payouts] = await Promise.all([
    getLedgerBalances(),
    MarketplaceOrderPayment.findAll({
      attributes: ['id', 'status', 'grossAmount', 'feeAmount', 'netAmount', 'refundedAmount', 'currency'],
    }),
    MarketplaceDispute.count({ where: { status: { [Op.in]: OPEN_DISPUTE_STATUSES } } }),
    MarketplacePayout.findAll({ where: { status: 'available' }, attributes: ['id', 'amount', 'currency'] }),
  ]);

  const paymentRows = payments.map((payment) => payment.get({ plain: true }));
  const payoutRows = payouts.map((payout) => payout.get({ plain: true }));
  const heldPayments = paymentRows.filter((payment) => payment.status === 'paid_held');
  const disputedPayments = paymentRows.filter((payment) => payment.status === 'disputed');
  const refundedPayments = paymentRows.filter((payment) => payment.status === 'refunded');
  const releasedPayments = paymentRows.filter((payment) => payment.status === 'released');
  const currency = paymentRows.find((payment) => payment.currency)?.currency || payoutRows.find((payout) => payout.currency)?.currency || 'GHS';

  return {
    balances: {
      ...ledgerBalances,
      pending: money(heldPayments.reduce((sum, payment) => sum + money(payment.netAmount), 0)),
      available: money(payoutRows.reduce((sum, payout) => sum + money(payout.amount), 0)),
      fee: money(paymentRows.reduce((sum, payment) => sum + money(payment.feeAmount), 0)),
      refunded: money(paymentRows.reduce((sum, payment) => sum + money(payment.refundedAmount), 0)),
      currency,
    },
    counts: {
      held: heldPayments.length,
      disputed: disputedPayments.length,
      refunded: refundedPayments.length,
      released: releasedPayments.length,
      openDisputes,
      payoutHistory: payoutRows.length,
    },
    autoReleaseHours: getAutoReleaseHours(),
  };
};

const tradeAssurancePaymentInclude = [
  {
    model: Sale,
    as: 'sale',
    attributes: ['id', 'saleNumber', 'total', 'status', 'orderStatus', 'deliveryStatus', 'createdAt'],
    include: [{ model: Customer, as: 'customer', attributes: ['id', 'name', 'email', 'phone'], required: false }],
    required: false,
  },
  { model: Tenant, as: 'tenant', attributes: ['id', 'name', 'slug'], required: false },
  { model: Shop, as: 'shop', attributes: ['id', 'name'], required: false },
  { model: StorefrontCustomer, as: 'storefrontCustomer', attributes: ['id', 'name', 'email', 'phone'], required: false },
];

const tradeAssuranceDisputeInclude = [
  {
    model: Sale,
    as: 'sale',
    attributes: ['id', 'saleNumber', 'total', 'status', 'orderStatus', 'deliveryStatus', 'createdAt'],
    include: [{ model: Customer, as: 'customer', attributes: ['id', 'name', 'email', 'phone'], required: false }],
    required: false,
  },
  { model: MarketplaceOrderPayment, as: 'marketplaceOrderPayment', required: false },
  { model: Tenant, as: 'tenant', attributes: ['id', 'name', 'slug'], required: false },
  { model: Shop, as: 'shop', attributes: ['id', 'name'], required: false },
  { model: StorefrontCustomer, as: 'storefrontCustomer', attributes: ['id', 'name', 'email', 'phone'], required: false },
];

const payoutInclude = [
  { model: Sale, as: 'sale', attributes: ['id', 'saleNumber'], required: false },
  { model: Tenant, as: 'tenant', attributes: ['id', 'name', 'slug'], required: false },
  { model: Shop, as: 'shop', attributes: ['id', 'name'], required: false },
];

exports.getSabitoOverview = async (req, res, next) => {
  try {
    const startOfToday = getStartOfToday();
    const [
      totalStores,
      activeStores,
      pendingStores,
      ordersToday,
      totalOrders,
      totalCustomers,
      payments,
      openDisputes,
      availablePayouts,
      recentStores,
      recentOrders,
      recentDisputes,
      ledgerBalances,
    ] = await Promise.all([
      OnlineStoreSettings.count(),
      OnlineStoreSettings.count({ where: { enabled: true } }),
      OnlineStoreSettings.count({ where: { [Op.or]: [{ enabled: false }, { setupCompletedAt: null }] } }),
      Sale.count({ where: onlineOrderWhere({ createdAt: { [Op.gte]: startOfToday } }) }),
      Sale.count({ where: onlineOrderWhere() }),
      StorefrontCustomer.count(),
      MarketplaceOrderPayment.findAll({
        attributes: ['id', 'status', 'grossAmount', 'feeAmount', 'netAmount', 'refundedAmount', 'currency'],
      }),
      MarketplaceDispute.count({ where: { status: { [Op.in]: OPEN_DISPUTE_STATUSES } } }),
      MarketplacePayout.findAll({ where: { status: 'available' }, attributes: ['id', 'amount', 'currency'] }),
      OnlineStoreSettings.findAll({
        include: [
          { model: Tenant, as: 'tenant', attributes: ['id', 'name', 'slug', 'status', 'plan'], required: false },
          { model: Shop, as: 'shop', attributes: ['id', 'name', 'isActive'], required: false },
        ],
        order: [['updatedAt', 'DESC']],
        limit: 5,
      }),
      Sale.findAll({
        where: onlineOrderWhere(),
        include: [
          { model: Tenant, as: 'tenant', attributes: ['id', 'name', 'slug'], required: false },
          { model: Shop, as: 'shop', attributes: ['id', 'name'], required: false },
          { model: Customer, as: 'customer', attributes: ['id', 'name', 'email', 'phone'], required: false },
          {
            model: MarketplaceOrderPayment,
            as: 'marketplacePayment',
            required: false,
            include: [{ model: StorefrontCustomer, as: 'storefrontCustomer', attributes: ['id', 'name', 'email'], required: false }],
          },
        ],
        order: [['createdAt', 'DESC']],
        limit: 5,
      }),
      MarketplaceDispute.findAll({
        include: [
          { model: Tenant, as: 'tenant', attributes: ['id', 'name', 'slug'], required: false },
          { model: Shop, as: 'shop', attributes: ['id', 'name'], required: false },
          { model: Sale, as: 'sale', attributes: ['id', 'saleNumber', 'total', 'createdAt'], required: false },
          { model: StorefrontCustomer, as: 'storefrontCustomer', attributes: ['id', 'name', 'email'], required: false },
        ],
        order: [['createdAt', 'DESC']],
        limit: 5,
      }),
      getLedgerBalances(),
    ]);

    const paymentRows = payments.map((payment) => payment.get({ plain: true }));
    const heldPayments = paymentRows.filter((payment) => payment.status === 'paid_held');
    const disputedPayments = paymentRows.filter((payment) => payment.status === 'disputed');
    const availableRows = availablePayouts.map((payout) => payout.get({ plain: true }));
    const currency = paymentRows.find((payment) => payment.currency)?.currency || availableRows.find((payout) => payout.currency)?.currency || 'GHS';

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalStores,
          activeStores,
          pendingStores,
          ordersToday,
          totalOrders,
          totalCustomers,
          heldPaymentCount: heldPayments.length,
          disputedPaymentCount: disputedPayments.length,
          openDisputes,
          heldPayoutAmount: money(heldPayments.reduce((sum, payment) => sum + money(payment.netAmount), 0)),
          availablePayoutAmount: money(availableRows.reduce((sum, payout) => sum + money(payout.amount), 0)),
          feeAmount: money(paymentRows.reduce((sum, payment) => sum + money(payment.feeAmount), 0)),
          refundedAmount: money(paymentRows.reduce((sum, payment) => sum + money(payment.refundedAmount), 0)),
          currency,
          ledgerBalances,
          autoReleaseHours: getAutoReleaseHours(),
        },
        recentStores: await Promise.all(recentStores.map(serializeStore)),
        recentOrders: recentOrders.map(serializeOrder),
        recentDisputes: recentDisputes.map((dispute) => dispute.get({ plain: true })),
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getSabitoStores = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req, { defaultPageSize: 20 });
    const { search, status } = req.query;
    const where = buildStoreSearchWhere(search);
    if (status === 'active') where.enabled = true;
    if (status === 'pending') {
      where[Op.and] = [
        ...(Array.isArray(where[Op.and]) ? where[Op.and] : []),
        { [Op.or]: [{ enabled: false }, { setupCompletedAt: null }] },
      ];
    }

    const { count, rows } = await OnlineStoreSettings.findAndCountAll({
      where,
      include: [
        { model: Tenant, as: 'tenant', attributes: ['id', 'name', 'slug', 'status', 'plan', 'businessType'], required: false },
        { model: Shop, as: 'shop', attributes: ['id', 'name', 'isActive', 'shopType', 'city', 'country'], required: false },
      ],
      order: [['updatedAt', 'DESC']],
      limit,
      offset,
      distinct: true,
    });

    res.status(200).json({
      success: true,
      data: await Promise.all(rows.map(serializeStore)),
      pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) || 1 },
    });
  } catch (error) {
    next(error);
  }
};

exports.getSabitoOrders = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req, { defaultPageSize: 20 });
    const { search, paymentStatus, orderStatus } = req.query;
    const where = { ...onlineOrderWhere(), ...buildOrderSearchWhere(search) };
    if (orderStatus && orderStatus !== 'all') where.orderStatus = orderStatus;

    const paymentWhere = {};
    if (paymentStatus && paymentStatus !== 'all') paymentWhere.status = paymentStatus;

    const { count, rows } = await Sale.findAndCountAll({
      where,
      include: [
        { model: Tenant, as: 'tenant', attributes: ['id', 'name', 'slug'], required: false },
        { model: Shop, as: 'shop', attributes: ['id', 'name'], required: false },
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'email', 'phone'], required: false },
        {
          model: MarketplaceOrderPayment,
          as: 'marketplacePayment',
          where: paymentWhere,
          required: Boolean(paymentStatus && paymentStatus !== 'all'),
          include: [{ model: StorefrontCustomer, as: 'storefrontCustomer', attributes: ['id', 'name', 'email', 'phone'], required: false }],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      distinct: true,
      subQuery: false,
    });

    res.status(200).json({
      success: true,
      data: rows.map(serializeOrder),
      pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) || 1 },
    });
  } catch (error) {
    next(error);
  }
};

exports.getSabitoOrder = async (req, res, next) => {
  try {
    const order = await Sale.findOne({
      where: onlineOrderWhere({ id: req.params.id }),
      include: [
        { model: Tenant, as: 'tenant', attributes: ['id', 'name', 'slug'], required: false },
        { model: Shop, as: 'shop', attributes: ['id', 'name'], required: false },
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'email', 'phone'], required: false },
        {
          model: MarketplaceOrderPayment,
          as: 'marketplacePayment',
          required: false,
          include: [{ model: StorefrontCustomer, as: 'storefrontCustomer', attributes: ['id', 'name', 'email', 'phone'], required: false }],
        },
        {
          model: SaleItem,
          as: 'items',
          required: false,
          include: [
            { model: Product, as: 'product', attributes: ['id', 'name', 'imageUrl'], required: false },
            { model: ProductVariant, as: 'variant', attributes: ['id', 'name', 'sku'], required: false },
          ],
        },
      ],
      order: [[{ model: SaleItem, as: 'items' }, 'createdAt', 'ASC']],
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Marketplace order not found',
        errorCode: 'SABITO_ORDER_NOT_FOUND',
      });
    }

    return res.status(200).json({
      success: true,
      data: serializeOrderDetail(order),
    });
  } catch (error) {
    return next(error);
  }
};

exports.releaseSabitoOrderPayout = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const order = await Sale.findOne({
      where: onlineOrderWhere({ id: req.params.id }),
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!order) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        error: 'Marketplace order not found',
        errorCode: 'SABITO_ORDER_NOT_FOUND',
      });
    }

    const payment = await releaseMarketplaceOrderPayment({
      tenantId: order.tenantId,
      shopId: order.shopId || null,
      saleId: order.id,
      actorUserId: req.user?.id || null,
      reason: String(req.body?.reason || 'sabito_admin_release').trim().slice(0, 120),
      transaction,
    });

    await transaction.commit();
    return res.status(200).json({
      success: true,
      message: 'Marketplace payout released by Sabito admin.',
      data: payment,
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    return next(error);
  }
};

exports.getSabitoTradeAssurance = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req, { defaultPageSize: 25 });
    const paymentWhere = {};
    if (req.query.paymentStatus && req.query.paymentStatus !== 'all') paymentWhere.status = req.query.paymentStatus;
    const disputeWhere = {};
    if (req.query.disputeStatus && req.query.disputeStatus !== 'all') disputeWhere.status = req.query.disputeStatus;
    const [summary, payments, disputes, payouts] = await Promise.all([
      getGlobalTradeAssuranceSummary(),
      MarketplaceOrderPayment.findAndCountAll({
        where: paymentWhere,
        include: tradeAssurancePaymentInclude,
        order: [['createdAt', 'DESC']],
        limit,
        offset,
        distinct: true,
      }),
      MarketplaceDispute.findAndCountAll({
        where: disputeWhere,
        include: tradeAssuranceDisputeInclude,
        order: [['createdAt', 'DESC']],
        limit: 10,
        offset: 0,
        distinct: true,
      }),
      MarketplacePayout.findAndCountAll({
        include: payoutInclude,
        order: [['createdAt', 'DESC']],
        limit: 10,
        offset: 0,
        distinct: true,
      }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        summary,
        payments: payments.rows,
        disputes: disputes.rows,
        payouts: payouts.rows,
        pagination: { page, limit, total: payments.count, totalPages: Math.ceil(payments.count / limit) || 1 },
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getSabitoDisputes = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req, { defaultPageSize: 20 });
    const where = {};
    if (req.query.status && req.query.status !== 'all') where.status = req.query.status;
    const result = await MarketplaceDispute.findAndCountAll({
      where,
      include: tradeAssuranceDisputeInclude,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      distinct: true,
    });

    res.status(200).json({
      success: true,
      data: result.rows,
      pagination: { page, limit, total: result.count, totalPages: Math.ceil(result.count / limit) || 1 },
    });
  } catch (error) {
    next(error);
  }
};

exports.getSabitoCustomers = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req, { defaultPageSize: 20 });
    const { search, status } = req.query;
    const where = buildCustomerSearchWhere(search);
    if (status === 'active') where.isActive = true;
    if (status === 'inactive') where.isActive = false;

    const { count, rows } = await StorefrontCustomer.findAndCountAll({
      where,
      attributes: ['id', 'name', 'email', 'phone', 'isActive', 'emailVerifiedAt', 'lastLoginAt', 'createdAt', 'updatedAt'],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    res.status(200).json({
      success: true,
      data: rows.map((customer) => customer.get({ plain: true })),
      pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) || 1 },
    });
  } catch (error) {
    next(error);
  }
};

exports.getSabitoSettings = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        commissionPercent: getCommissionPercent(),
        fixedFeeAmount: getCommissionFixedAmount(),
        autoReleaseHours: getAutoReleaseHours(),
        currency: process.env.SABITO_MARKETPLACE_CURRENCY || 'GHS',
        editable: false,
      },
    });
  } catch (error) {
    next(error);
  }
};
