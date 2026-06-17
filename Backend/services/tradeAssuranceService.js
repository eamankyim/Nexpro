const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const {
  Customer,
  MarketplaceDispute,
  MarketplaceLedgerEntry,
  MarketplaceOrderPayment,
  MarketplacePayout,
  Sale,
  SaleActivity,
  Shop,
} = require('../models');

const ONLINE_STORE_SOURCE = 'online_store';
const DEFAULT_CURRENCY = 'GHS';
const DEFAULT_COMMISSION_PERCENT = 1;
const DEFAULT_AUTO_RELEASE_HOURS = 72;

const money = (value) => Number((Number.parseFloat(value || 0) || 0).toFixed(2));

const addAndCondition = (where, condition) => {
  where[Op.and] = Array.isArray(where[Op.and])
    ? [...where[Op.and], condition]
    : (where[Op.and] ? [where[Op.and], condition] : [condition]);
  return where;
};

const buildScopedWhere = ({ tenantId, shopId = null, includeLegacyShopNull = false }) => {
  const where = { tenantId };
  if (shopId) {
    if (includeLegacyShopNull) {
      addAndCondition(where, { [Op.or]: [{ shopId }, { shopId: null }] });
    } else {
      where.shopId = shopId;
    }
  }
  return where;
};

const getCommissionPercent = () => {
  const configured = Number.parseFloat(process.env.SABITO_MARKETPLACE_COMMISSION_PERCENT);
  return Number.isFinite(configured) && configured >= 0 ? configured : DEFAULT_COMMISSION_PERCENT;
};

const getCommissionFixedAmount = () => {
  const configured = Number.parseFloat(process.env.SABITO_MARKETPLACE_COMMISSION_FIXED_FEE);
  return Number.isFinite(configured) && configured >= 0 ? configured : 0;
};

const getAutoReleaseHours = () => {
  const configured = Number.parseFloat(process.env.SABITO_TRADE_ASSURANCE_AUTO_RELEASE_HOURS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_AUTO_RELEASE_HOURS;
};

const calculateMarketplaceFee = (grossAmount, options = {}) => {
  const gross = money(grossAmount);
  const percent = Number.isFinite(Number.parseFloat(options.percent))
    ? Number.parseFloat(options.percent)
    : getCommissionPercent();
  const fixed = Number.isFinite(Number.parseFloat(options.fixedAmount))
    ? Number.parseFloat(options.fixedAmount)
    : getCommissionFixedAmount();
  const feeAmount = Math.min(gross, money((gross * percent / 100) + fixed));
  return {
    grossAmount: gross,
    feeAmount,
    netAmount: money(gross - feeAmount),
    commissionPercent: percent,
    fixedFeeAmount: money(fixed),
  };
};

const getSaleMetadata = (sale) => (
  sale?.metadata && typeof sale.metadata === 'object' && !Array.isArray(sale.metadata)
    ? { ...sale.metadata }
    : {}
);

const getReleaseEligibleAt = (baseDate = new Date()) => (
  new Date(new Date(baseDate).getTime() + getAutoReleaseHours() * 60 * 60 * 1000)
);

const getPayoutNumber = () => `MPO-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

const getRemainingSellerAmount = (payment) => {
  const gross = money(payment.grossAmount);
  const net = money(payment.netAmount);
  const refunded = Math.min(money(payment.refundedAmount), gross);
  if (gross <= 0) return 0;
  return money(net * Math.max(gross - refunded, 0) / gross);
};

const getPlain = (record) => (typeof record?.get === 'function' ? record.get({ plain: true }) : record);

const getPaymentCurrency = (records, fallback = DEFAULT_CURRENCY) => {
  const record = records.find((item) => getPlain(item)?.currency);
  return getPlain(record)?.currency || fallback;
};

const sumAmounts = (records, selector) => money(records.reduce((total, record) => (
  total + money(selector(getPlain(record)))
), 0));

const metadataContains = (value) => ({ metadata: { [Op.contains]: value } });

const getMetadataTradeAssuranceSales = async ({
  tenantId,
  shopId = null,
  includeLegacyShopNull = false,
  statuses = [],
  excludedSaleIds = [],
}) => {
  if (!statuses.length) return [];

  const where = buildScopedWhere({ tenantId, shopId, includeLegacyShopNull });
  addAndCondition(where, metadataContains({ source: ONLINE_STORE_SOURCE }));
  addAndCondition(where, {
    [Op.or]: statuses.map((status) => (
      metadataContains({ tradeAssurance: { paymentStatus: status } })
    )),
  });
  where.status = { [Op.notIn]: ['cancelled', 'refunded'] };
  if (excludedSaleIds.length) {
    where.id = { [Op.notIn]: excludedSaleIds };
  }

  return Sale.findAll({
    where,
    attributes: ['id', 'total', 'metadata'],
  });
};

const getMetadataFee = (sale) => {
  const plain = getPlain(sale) || {};
  const tradeAssurance = getSaleMetadata(plain).tradeAssurance || {};
  if (tradeAssurance.feeAmount != null) return money(tradeAssurance.feeAmount);
  return calculateMarketplaceFee(plain.total).feeAmount;
};

const getMetadataNet = (sale) => {
  const plain = getPlain(sale) || {};
  const tradeAssurance = getSaleMetadata(plain).tradeAssurance || {};
  if (tradeAssurance.netAmount != null) return money(tradeAssurance.netAmount);
  return calculateMarketplaceFee(plain.total).netAmount;
};

const getMetadataPaymentStatus = (sale) => (
  getSaleMetadata(getPlain(sale)).tradeAssurance?.paymentStatus || null
);

const ledgerPayload = ({ payment, entryType, balanceType, direction, amount, description, actorUserId, metadata = {}, payout = null }) => ({
  tenantId: payment.tenantId,
  shopId: payment.shopId || null,
  saleId: payment.saleId || null,
  marketplaceOrderPaymentId: payment.id,
  marketplacePayoutId: payout?.id || null,
  entryType,
  balanceType,
  direction,
  amount: money(amount),
  currency: payment.currency || DEFAULT_CURRENCY,
  description,
  createdBy: actorUserId || null,
  metadata,
});

const createLedgerEntry = (payload, transaction) => MarketplaceLedgerEntry.create(payload, { transaction });

const updateSaleTradeAssuranceMetadata = async (sale, tradeAssuranceUpdate, transaction) => {
  const metadata = getSaleMetadata(sale);
  metadata.tradeAssurance = {
    ...(metadata.tradeAssurance || {}),
    ...tradeAssuranceUpdate,
  };
  await sale.update({ metadata }, { transaction });
  return metadata;
};

const recordHeldPaymentForSale = async ({ sale, store, shopper, transaction, provider = 'sabito_held', providerReference = null }) => {
  const existing = await MarketplaceOrderPayment.findOne({
    where: { saleId: sale.id },
    transaction,
    lock: transaction?.LOCK?.UPDATE,
  });
  if (existing) return existing;

  const fee = calculateMarketplaceFee(sale.total);
  const heldAt = new Date();
  const payment = await MarketplaceOrderPayment.create({
    tenantId: sale.tenantId,
    shopId: sale.shopId || null,
    saleId: sale.id,
    storefrontCustomerId: shopper?.id || null,
    currency: store?.currency || DEFAULT_CURRENCY,
    grossAmount: fee.grossAmount,
    feeAmount: fee.feeAmount,
    netAmount: fee.netAmount,
    status: 'paid_held',
    paymentProvider: provider,
    providerReference,
    heldAt,
    metadata: {
      source: ONLINE_STORE_SOURCE,
      commissionPercent: fee.commissionPercent,
      fixedFeeAmount: fee.fixedFeeAmount,
      storeSlug: store?.slug || null,
    },
  }, { transaction });

  if (fee.netAmount > 0) {
    await createLedgerEntry(ledgerPayload({
      payment,
      entryType: 'hold',
      balanceType: 'pending',
      direction: 'credit',
      amount: fee.netAmount,
      description: `Held seller payable for order ${sale.saleNumber}`,
    }), transaction);
  }
  if (fee.feeAmount > 0) {
    await createLedgerEntry(ledgerPayload({
      payment,
      entryType: 'fee',
      balanceType: 'fee',
      direction: 'credit',
      amount: fee.feeAmount,
      description: `Sabito marketplace fee for order ${sale.saleNumber}`,
    }), transaction);
  }

  const metadata = getSaleMetadata(sale);
  metadata.tradeAssurance = {
    ...(metadata.tradeAssurance || {}),
    marketplacePaymentId: payment.id,
    paymentStatus: 'paid_held',
    heldAt: heldAt.toISOString(),
    grossAmount: fee.grossAmount,
    feeAmount: fee.feeAmount,
    netAmount: fee.netAmount,
    commissionPercent: fee.commissionPercent,
    payoutHold: true,
    payoutReleaseEligible: false,
  };

  await sale.update({
    status: 'completed',
    amountPaid: fee.grossAmount,
    change: 0,
    metadata,
  }, { transaction });

  return payment;
};

const markReleaseEligibleForSale = async ({ sale, confirmedAt = new Date(), transaction }) => {
  const payment = await MarketplaceOrderPayment.findOne({
    where: { saleId: sale.id },
    transaction,
    lock: transaction?.LOCK?.UPDATE,
  });
  if (!payment || !['paid_held', 'disputed'].includes(payment.status)) return payment;

  const releaseEligibleAt = new Date(confirmedAt);
  await payment.update({
    releaseEligibleAt,
    status: payment.status === 'disputed' ? 'disputed' : 'paid_held',
    metadata: {
      ...(payment.metadata || {}),
      buyerConfirmedAt: releaseEligibleAt.toISOString(),
      releaseEligibilitySource: 'buyer_confirmed',
    },
  }, { transaction });

  await updateSaleTradeAssuranceMetadata(sale, {
    buyerConfirmedAt: releaseEligibleAt.toISOString(),
    payoutReleaseEligible: true,
    payoutReleaseEligibleAt: releaseEligibleAt.toISOString(),
    paymentStatus: payment.status,
  }, transaction);

  return payment;
};

const markDeliveryReleaseWindowForSale = async ({ sale, deliveredAt = new Date(), transaction }) => {
  const payment = await MarketplaceOrderPayment.findOne({
    where: { saleId: sale.id },
    transaction,
    lock: transaction?.LOCK?.UPDATE,
  });
  if (!payment || payment.releaseEligibleAt || payment.status !== 'paid_held') return payment;

  const releaseEligibleAt = getReleaseEligibleAt(deliveredAt);
  await payment.update({
    releaseEligibleAt,
    metadata: {
      ...(payment.metadata || {}),
      deliveredAt: new Date(deliveredAt).toISOString(),
      autoReleaseHours: getAutoReleaseHours(),
      releaseEligibilitySource: 'delivery_timeout',
    },
  }, { transaction });

  await updateSaleTradeAssuranceMetadata(sale, {
    deliveredAt: new Date(deliveredAt).toISOString(),
    confirmReceivedEligible: true,
    payoutReleaseEligible: false,
    payoutReleaseEligibleAt: releaseEligibleAt.toISOString(),
    autoReleaseHours: getAutoReleaseHours(),
  }, transaction);

  return payment;
};

const openDisputeForSale = async ({ sale, dispute, transaction }) => {
  const payment = await MarketplaceOrderPayment.findOne({
    where: { saleId: sale.id },
    transaction,
    lock: transaction?.LOCK?.UPDATE,
  });

  const record = await MarketplaceDispute.create({
    id: dispute.id,
    tenantId: sale.tenantId,
    shopId: sale.shopId || null,
    saleId: sale.id,
    marketplaceOrderPaymentId: payment?.id || null,
    storefrontCustomerId: dispute.openedByStorefrontCustomerId || null,
    status: 'open',
    reason: dispute.reason || 'issue',
    message: dispute.message || null,
    openedByEmail: dispute.openedByEmail || null,
    openedAt: dispute.openedAt ? new Date(dispute.openedAt) : new Date(),
    metadata: {
      source: ONLINE_STORE_SOURCE,
    },
  }, { transaction });

  if (payment && payment.status !== 'refunded') {
    await payment.update({
      status: 'disputed',
      metadata: {
        ...(payment.metadata || {}),
        disputeId: record.id,
        disputedAt: new Date().toISOString(),
      },
    }, { transaction });
  }

  return record;
};

const releaseMarketplacePayment = async ({ payment, actorUserId = null, reason = 'manual_release', transaction }) => {
  if (!payment) {
    const error = new Error('Marketplace payment not found');
    error.statusCode = 404;
    throw error;
  }
  if (payment.status === 'refunded') {
    const error = new Error('Refunded marketplace payments cannot be released.');
    error.statusCode = 400;
    throw error;
  }
  if (payment.status === 'released') return payment;

  const amount = getRemainingSellerAmount(payment);
  if (amount <= 0) {
    await payment.update({ status: 'refunded', refundedAt: payment.refundedAt || new Date() }, { transaction });
    return payment;
  }

  const releasedAt = new Date();
  const payout = await MarketplacePayout.create({
    tenantId: payment.tenantId,
    shopId: payment.shopId || null,
    saleId: payment.saleId,
    marketplaceOrderPaymentId: payment.id,
    payoutNumber: getPayoutNumber(),
    amount,
    currency: payment.currency || DEFAULT_CURRENCY,
    status: 'available',
    releaseReason: reason,
    releasedBy: actorUserId || null,
    releasedAt,
    metadata: {
      source: ONLINE_STORE_SOURCE,
      paymentStatusBeforeRelease: payment.status,
    },
  }, { transaction });

  await createLedgerEntry(ledgerPayload({
    payment,
    payout,
    entryType: 'release',
    balanceType: 'pending',
    direction: 'debit',
    amount,
    description: `Released pending held funds for order payout ${payout.payoutNumber}`,
    actorUserId,
  }), transaction);
  await createLedgerEntry(ledgerPayload({
    payment,
    payout,
    entryType: 'release',
    balanceType: 'available',
    direction: 'credit',
    amount,
    description: `Seller balance available from order payout ${payout.payoutNumber}`,
    actorUserId,
  }), transaction);

  await MarketplaceDispute.update({
    status: 'resolved_release',
    resolvedAt: releasedAt,
    resolvedBy: actorUserId || null,
    resolutionNotes: reason,
  }, {
    where: {
      marketplaceOrderPaymentId: payment.id,
      status: { [Op.in]: ['open', 'under_review'] },
    },
    transaction,
  });

  const updated = await payment.update({
    status: 'released',
    releasedAt,
    metadata: {
      ...(payment.metadata || {}),
      releasedBy: actorUserId || null,
      releaseReason: reason,
      payoutId: payout.id,
    },
  }, { transaction });

  const sale = await Sale.findByPk(payment.saleId, { transaction, lock: transaction?.LOCK?.UPDATE });
  if (sale) {
    await updateSaleTradeAssuranceMetadata(sale, {
      paymentStatus: 'released',
      payoutHold: false,
      payoutReleasedAt: releasedAt.toISOString(),
      payoutId: payout.id,
    }, transaction);
    await SaleActivity.create({
      saleId: sale.id,
      tenantId: sale.tenantId,
      type: 'payment',
      subject: 'Marketplace payout released',
      notes: `Held funds released to seller available balance: ${amount.toFixed(2)} ${payment.currency || DEFAULT_CURRENCY}.`,
      createdBy: actorUserId || null,
      metadata: {
        source: ONLINE_STORE_SOURCE,
        action: 'release_marketplace_payout',
        marketplaceOrderPaymentId: payment.id,
        marketplacePayoutId: payout.id,
      },
    }, { transaction });
  }

  return updated;
};

const releaseMarketplaceOrderPayment = async ({ tenantId, shopId = null, saleId, actorUserId = null, reason = 'manual_release', transaction }) => {
  const where = { tenantId, saleId };
  if (shopId) where.shopId = shopId;
  const payment = await MarketplaceOrderPayment.findOne({
    where,
    transaction,
    lock: transaction?.LOCK?.UPDATE,
  });
  return releaseMarketplacePayment({ payment, actorUserId, reason, transaction });
};

const refundMarketplaceOrderPayment = async ({ tenantId, shopId = null, saleId, amount, actorUserId = null, reason = 'refund', transaction }) => {
  const where = { tenantId, saleId };
  if (shopId) where.shopId = shopId;
  const payment = await MarketplaceOrderPayment.findOne({
    where,
    transaction,
    lock: transaction?.LOCK?.UPDATE,
  });
  if (!payment) {
    const error = new Error('Marketplace payment not found');
    error.statusCode = 404;
    throw error;
  }

  const gross = money(payment.grossAmount);
  const alreadyRefunded = money(payment.refundedAmount);
  const refundAmount = amount == null ? money(gross - alreadyRefunded) : money(amount);
  if (refundAmount <= 0 || refundAmount > money(gross - alreadyRefunded)) {
    const error = new Error('Refund amount exceeds the remaining held payment.');
    error.statusCode = 400;
    throw error;
  }
  if (payment.status === 'refunded') {
    const error = new Error('This marketplace payment has already been fully refunded.');
    error.statusCode = 400;
    throw error;
  }

  const refundNetAmount = money(payment.netAmount * (refundAmount / gross));
  const sourceBalance = payment.status === 'released' ? 'available' : 'pending';
  const refundedAmount = money(alreadyRefunded + refundAmount);
  const isFullRefund = refundedAmount >= gross;
  const refundedAt = new Date();

  await createLedgerEntry(ledgerPayload({
    payment,
    entryType: 'refund',
    balanceType: sourceBalance,
    direction: 'debit',
    amount: refundNetAmount,
    description: `Marketplace order refund: ${reason}`,
    actorUserId,
    metadata: { grossRefundAmount: refundAmount },
  }), transaction);
  await createLedgerEntry(ledgerPayload({
    payment,
    entryType: 'refund',
    balanceType: 'refunded',
    direction: 'credit',
    amount: refundAmount,
    description: `Buyer refund recorded: ${reason}`,
    actorUserId,
    metadata: { sellerPortionAmount: refundNetAmount },
  }), transaction);

  const status = isFullRefund ? 'refunded' : payment.status;
  const updated = await payment.update({
    refundedAmount,
    status,
    refundedAt: isFullRefund ? refundedAt : payment.refundedAt,
    metadata: {
      ...(payment.metadata || {}),
      lastRefundAt: refundedAt.toISOString(),
      lastRefundReason: reason,
      lastRefundAmount: refundAmount,
    },
  }, { transaction });

  await MarketplaceDispute.update({
    status: 'resolved_refund',
    resolvedAt: refundedAt,
    resolvedBy: actorUserId || null,
    resolutionNotes: reason,
  }, {
    where: {
      marketplaceOrderPaymentId: payment.id,
      status: { [Op.in]: ['open', 'under_review'] },
    },
    transaction,
  });

  const sale = await Sale.findByPk(payment.saleId, { transaction, lock: transaction?.LOCK?.UPDATE });
  if (sale) {
    await updateSaleTradeAssuranceMetadata(sale, {
      paymentStatus: status,
      refundedAmount,
      lastRefundAt: refundedAt.toISOString(),
      partialRefund: !isFullRefund,
    }, transaction);
    if (isFullRefund) {
      await sale.update({ status: 'refunded' }, { transaction });
    }
    await SaleActivity.create({
      saleId: sale.id,
      tenantId: sale.tenantId,
      type: 'refund',
      subject: isFullRefund ? 'Marketplace order refunded' : 'Marketplace order partially refunded',
      notes: `${refundAmount.toFixed(2)} ${payment.currency || DEFAULT_CURRENCY} refund recorded. Reason: ${reason}`,
      createdBy: actorUserId || null,
      metadata: {
        source: ONLINE_STORE_SOURCE,
        action: 'refund_marketplace_order',
        marketplaceOrderPaymentId: payment.id,
        refundAmount,
        sellerPortionAmount: refundNetAmount,
      },
    }, { transaction });
  }

  return updated;
};

const releaseEligiblePayments = async (payments, transaction = null) => {
  const released = [];
  for (const payment of payments) {
    const openDispute = await MarketplaceDispute.findOne({
      where: {
        marketplaceOrderPaymentId: payment.id,
        status: { [Op.in]: ['open', 'under_review'] },
      },
      transaction,
    });
    if (openDispute) continue;
    const sale = payment.sale;
    const delivered = sale?.deliveryStatus === 'delivered' || sale?.orderStatus === 'completed' || sale?.orderStatus === 'delivered';
    const metadata = getSaleMetadata(sale);
    if (!delivered && !metadata.tradeAssurance?.buyerConfirmedAt) continue;
    released.push(await releaseMarketplacePayment({
      payment,
      actorUserId: null,
      reason: 'auto_release_after_confirmation_window',
      transaction,
    }));
  }
  return released;
};

const processAutoReleaseCandidates = async ({ tenantId, shopId = null, includeLegacyShopNull = false, transaction = null }) => {
  const now = new Date();
  const where = buildScopedWhere({ tenantId, shopId, includeLegacyShopNull });
  Object.assign(where, {
    status: 'paid_held',
    releaseEligibleAt: { [Op.lte]: now },
  });

  const payments = await MarketplaceOrderPayment.findAll({
    where,
    include: [{
      model: Sale,
      as: 'sale',
      attributes: ['id', 'orderStatus', 'deliveryStatus', 'status', 'metadata'],
      required: true,
      where: {
        status: { [Op.notIn]: ['cancelled', 'refunded'] },
      },
    }],
    limit: 25,
    transaction,
    lock: transaction?.LOCK?.UPDATE,
  });

  return releaseEligiblePayments(payments, transaction);
};

const processAllAutoReleaseCandidates = async ({ limit = 25, transaction = null } = {}) => {
  const now = new Date();
  const payments = await MarketplaceOrderPayment.findAll({
    where: {
      status: 'paid_held',
      releaseEligibleAt: { [Op.lte]: now },
    },
    include: [{
      model: Sale,
      as: 'sale',
      attributes: ['id', 'orderStatus', 'deliveryStatus', 'status', 'metadata'],
      required: true,
      where: {
        status: { [Op.notIn]: ['cancelled', 'refunded'] },
      },
    }],
    limit: Math.min(Math.max(Number(limit) || 25, 1), 100),
    transaction,
    lock: transaction?.LOCK?.UPDATE,
  });

  return releaseEligiblePayments(payments, transaction);
};

const finalizeMarketplacePayoutTransfer = async ({
  payoutId,
  transferReference = null,
  transferCode = null,
  paidAt = new Date(),
  webhookPayload = {},
}) => {
  const { sequelize } = require('../config/database');
  const transaction = await sequelize.transaction();
  try {
    const payout = await MarketplacePayout.findOne({
      where: { id: payoutId, status: { [Op.in]: ['available', 'processing'] } },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!payout) {
      await transaction.rollback();
      return null;
    }

    const payment = payout.marketplaceOrderPaymentId
      ? await MarketplaceOrderPayment.findByPk(payout.marketplaceOrderPaymentId, { transaction })
      : null;
    const amount = money(payout.amount);
    const paidOutAt = paidAt instanceof Date ? paidAt : new Date(paidAt);

    if (payment && amount > 0) {
      await createLedgerEntry(ledgerPayload({
        payment,
        payout,
        entryType: 'payout',
        balanceType: 'available',
        direction: 'debit',
        amount,
        description: `Paystack transfer sent for payout ${payout.payoutNumber}`,
        metadata: { transferReference, transferCode, ...webhookPayload },
      }), transaction);
      await createLedgerEntry(ledgerPayload({
        payment,
        payout,
        entryType: 'payout',
        balanceType: 'paid_out',
        direction: 'credit',
        amount,
        description: `Seller paid out via Paystack for ${payout.payoutNumber}`,
        metadata: { transferReference, transferCode, ...webhookPayload },
      }), transaction);
    }

    await payout.update({
      status: 'paid_out',
      paidOutAt,
      metadata: {
        ...(payout.metadata || {}),
        paystackTransferReference: transferReference || payout.metadata?.paystackTransferReference || null,
        paystackTransferCode: transferCode || payout.metadata?.paystackTransferCode || null,
        paystackTransferStatus: 'success',
        paystackTransferCompleted: true,
        paystackTransferCompletedAt: paidOutAt.toISOString(),
        payoutBlockedReason: null,
        lastTransferWebhook: webhookPayload,
      },
    }, { transaction });

    if (payment?.saleId) {
      const sale = await Sale.findByPk(payment.saleId, { transaction, lock: transaction.LOCK.UPDATE });
      if (sale) {
        await updateSaleTradeAssuranceMetadata(sale, {
          payoutPaidOutAt: paidOutAt.toISOString(),
          payoutTransferReference: transferReference,
        }, transaction);
        await SaleActivity.create({
          saleId: sale.id,
          tenantId: sale.tenantId,
          type: 'payment',
          subject: 'Marketplace payout sent to seller',
          notes: `Paystack transfer completed for payout ${payout.payoutNumber}: ${amount.toFixed(2)} ${payout.currency || DEFAULT_CURRENCY}.`,
          createdBy: null,
          metadata: {
            source: ONLINE_STORE_SOURCE,
            action: 'marketplace_payout_paid_out',
            marketplaceOrderPaymentId: payment.id,
            marketplacePayoutId: payout.id,
            transferReference,
            transferCode,
          },
        }, { transaction });
      }
    }

    await transaction.commit();
    return payout;
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    throw error;
  }
};

const revertMarketplacePayoutToAvailable = async ({
  payoutId,
  reason = 'transfer_failed',
  webhookEvent = null,
  transferReference = null,
  transferCode = null,
}) => {
  const payout = await MarketplacePayout.findByPk(payoutId);
  if (!payout || payout.status !== 'processing') return null;

  const attempts = Number(payout.metadata?.transferAttempts || 0);

  return payout.update({
    status: 'available',
    metadata: {
      ...(payout.metadata || {}),
      paystackTransferReference: transferReference || payout.metadata?.paystackTransferReference || null,
      paystackTransferCode: transferCode || payout.metadata?.paystackTransferCode || null,
      paystackTransferStatus: 'failed',
      lastTransferFailureAt: new Date().toISOString(),
      lastTransferFailureReason: reason,
      lastTransferWebhookEvent: webhookEvent,
      payoutBlockedReason: attempts >= 5 ? 'max_transfer_attempts_reached' : null,
    },
  });
};

const toSignedAmount = (entry) => {
  const amount = money(entry.amount);
  return entry.direction === 'debit' ? -amount : amount;
};

const getLedgerBalances = async ({ tenantId, shopId = null, includeLegacyShopNull = false }) => {
  const where = buildScopedWhere({ tenantId, shopId, includeLegacyShopNull });
  const rows = await MarketplaceLedgerEntry.findAll({
    where,
    attributes: [
      'balanceType',
      [sequelize.literal('SUM(CASE WHEN direction = \'debit\' THEN -"amount" ELSE "amount" END)'), 'balance'],
      [sequelize.fn('MAX', sequelize.col('currency')), 'currency'],
    ],
    group: ['balanceType'],
    raw: true,
  });

  const balances = {
    pending: 0,
    available: 0,
    paid_out: 0,
    fee: 0,
    refunded: 0,
    currency: DEFAULT_CURRENCY,
  };

  rows.forEach((row) => {
    if (row.balanceType) {
      balances[row.balanceType] = money(row.balance);
    }
    if (row.currency) {
      balances.currency = row.currency;
    }
  });

  return balances;
};

const getPaymentSummaryMetrics = async (paymentWhere) => {
  const heldPendingExpression = sequelize.literal(
    'CASE WHEN "grossAmount" <= 0 THEN 0 ELSE "netAmount" * GREATEST("grossAmount" - COALESCE("refundedAmount", 0), 0) / "grossAmount" END'
  );

  const [
    statusRows,
    heldPending,
    feeTotal,
    currencyPayment,
  ] = await Promise.all([
    MarketplaceOrderPayment.findAll({
      where: paymentWhere,
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      ],
      group: ['status'],
      raw: true,
    }),
    MarketplaceOrderPayment.sum(heldPendingExpression, {
      where: { ...paymentWhere, status: 'paid_held' },
    }),
    MarketplaceOrderPayment.sum('feeAmount', {
      where: {
        ...paymentWhere,
        status: { [Op.in]: ['paid_held', 'disputed', 'released'] },
      },
    }),
    MarketplaceOrderPayment.findOne({
      where: paymentWhere,
      attributes: ['currency'],
      order: [['createdAt', 'DESC']],
      raw: true,
    }),
  ]);

  const countsByStatus = statusRows.reduce((acc, row) => {
    acc[row.status] = Number(row.count || 0);
    return acc;
  }, {});

  return {
    countsByStatus,
    heldPending: money(heldPending || 0),
    feeTotal: money(feeTotal || 0),
    currency: currencyPayment?.currency || null,
  };
};

const getTradeAssuranceSummary = async ({ tenantId, shopId = null, includeLegacyShopNull = false }) => {
  await processAutoReleaseCandidates({ tenantId, shopId, includeLegacyShopNull });
  const paymentWhere = buildScopedWhere({ tenantId, shopId, includeLegacyShopNull });
  const disputeWhere = buildScopedWhere({ tenantId, shopId, includeLegacyShopNull });
  const payoutWhere = buildScopedWhere({ tenantId, shopId, includeLegacyShopNull });
  const availablePayoutWhere = { ...payoutWhere, status: 'available' };

  const [
    ledgerBalances,
    paymentMetrics,
    excludedSaleRows,
    openDisputes,
    availablePayoutTotal,
    availablePayoutCount,
    payoutCurrencyRow,
  ] = await Promise.all([
    getLedgerBalances({ tenantId, shopId, includeLegacyShopNull }),
    getPaymentSummaryMetrics(paymentWhere),
    MarketplaceOrderPayment.findAll({
      where: paymentWhere,
      attributes: ['saleId'],
      raw: true,
    }),
    MarketplaceDispute.count({ where: { ...disputeWhere, status: { [Op.in]: ['open', 'under_review'] } } }),
    MarketplacePayout.sum('amount', { where: availablePayoutWhere }),
    MarketplacePayout.count({ where: availablePayoutWhere }),
    MarketplacePayout.findOne({
      where: availablePayoutWhere,
      attributes: ['currency'],
      raw: true,
    }),
  ]);

  const metadataPayments = await getMetadataTradeAssuranceSales({
    tenantId,
    shopId,
    includeLegacyShopNull,
    statuses: ['paid_held', 'released', 'disputed'],
    excludedSaleIds: excludedSaleRows.map((payment) => payment.saleId).filter(Boolean),
  });

  const metadataRows = metadataPayments.map(getPlain);
  const metadataHeld = metadataRows.filter((sale) => getMetadataPaymentStatus(sale) === 'paid_held');
  const metadataDisputed = metadataRows.filter((sale) => getMetadataPaymentStatus(sale) === 'disputed');
  const metadataReleased = metadataRows.filter((sale) => getMetadataPaymentStatus(sale) === 'released');
  const { countsByStatus, heldPending, feeTotal, currency: paymentCurrency } = paymentMetrics;
  const pending = money(heldPending + sumAmounts(metadataHeld, getMetadataNet));
  const available = money(availablePayoutTotal || 0);
  const fee = money(feeTotal + sumAmounts(metadataRows, getMetadataFee));
  const currency = paymentCurrency || payoutCurrencyRow?.currency || ledgerBalances.currency || DEFAULT_CURRENCY;

  return {
    balances: {
      ...ledgerBalances,
      pending,
      available,
      fee,
      currency,
    },
    counts: {
      held: (countsByStatus.paid_held || 0) + metadataHeld.length,
      disputed: (countsByStatus.disputed || 0) + metadataDisputed.length,
      refunded: countsByStatus.refunded || 0,
      released: (countsByStatus.released || 0) + metadataReleased.length,
      openDisputes,
      payoutHistory: availablePayoutCount,
    },
    autoReleaseHours: getAutoReleaseHours(),
    commissionPercent: getCommissionPercent(),
  };
};

const listTradeAssurancePayments = async ({ tenantId, shopId = null, includeLegacyShopNull = false, status = null, limit = 50, offset = 0 }) => {
  const where = buildScopedWhere({ tenantId, shopId, includeLegacyShopNull });
  if (status && status !== 'all') where.status = status;
  const { count, rows } = await MarketplaceOrderPayment.findAndCountAll({
    where,
    include: [
      {
        model: Sale,
        as: 'sale',
        attributes: ['id', 'saleNumber', 'total', 'status', 'orderStatus', 'deliveryStatus', 'createdAt'],
        include: [{ model: Customer, as: 'customer', attributes: ['id', 'name', 'email', 'phone'], required: false }],
      },
      { model: Shop, as: 'shop', attributes: ['id', 'name'], required: false },
    ],
    order: [['createdAt', 'DESC']],
    limit,
    offset,
    distinct: true,
  });
  return { count, rows };
};

const listTradeAssuranceDisputes = async ({ tenantId, shopId = null, includeLegacyShopNull = false, status = null, limit = 50, offset = 0 }) => {
  const where = buildScopedWhere({ tenantId, shopId, includeLegacyShopNull });
  if (status && status !== 'all') where.status = status;
  const { count, rows } = await MarketplaceDispute.findAndCountAll({
    where,
    include: [
      {
        model: Sale,
        as: 'sale',
        attributes: ['id', 'saleNumber', 'total', 'status', 'orderStatus', 'deliveryStatus', 'createdAt'],
        include: [{ model: Customer, as: 'customer', attributes: ['id', 'name', 'email', 'phone'], required: false }],
      },
      { model: MarketplaceOrderPayment, as: 'marketplaceOrderPayment', required: false },
      { model: Shop, as: 'shop', attributes: ['id', 'name'], required: false },
    ],
    order: [['createdAt', 'DESC']],
    limit,
    offset,
    distinct: true,
  });
  return { count, rows };
};

const listPayoutHistory = async ({ tenantId, shopId = null, includeLegacyShopNull = false, limit = 25, offset = 0 }) => {
  const where = buildScopedWhere({ tenantId, shopId, includeLegacyShopNull });
  const { count, rows } = await MarketplacePayout.findAndCountAll({
    where,
    include: [
      { model: Sale, as: 'sale', attributes: ['id', 'saleNumber'], required: false },
      { model: Shop, as: 'shop', attributes: ['id', 'name'], required: false },
    ],
    order: [['createdAt', 'DESC']],
    limit,
    offset,
    distinct: true,
  });
  return { count, rows };
};

module.exports = {
  calculateMarketplaceFee,
  getCommissionFixedAmount,
  getCommissionPercent,
  getAutoReleaseHours,
  getReleaseEligibleAt,
  recordHeldPaymentForSale,
  markReleaseEligibleForSale,
  markDeliveryReleaseWindowForSale,
  openDisputeForSale,
  releaseMarketplaceOrderPayment,
  refundMarketplaceOrderPayment,
  processAutoReleaseCandidates,
  processAllAutoReleaseCandidates,
  finalizeMarketplacePayoutTransfer,
  revertMarketplacePayoutToAvailable,
  getTradeAssuranceSummary,
  listTradeAssurancePayments,
  listTradeAssuranceDisputes,
  listPayoutHistory,
};
