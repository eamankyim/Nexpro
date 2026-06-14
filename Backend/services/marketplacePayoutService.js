const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const paystackService = require('./paystackService');
const {
  finalizeMarketplacePayoutTransfer,
  revertMarketplacePayoutToAvailable,
} = require('./tradeAssuranceService');
const {
  MarketplacePayout,
  Tenant,
} = require('../models');

const LOG_PREFIX = '[MarketplacePayout]';
const DEFAULT_CURRENCY = 'GHS';
const MIN_TRANSFER_PESEWAS = 100;
const MAX_TRANSFER_ATTEMPTS = 5;
const DEFAULT_BATCH_LIMIT = 20;

const money = (value) => Number((Number.parseFloat(value || 0) || 0).toFixed(2));

const getPlain = (record) => (typeof record?.get === 'function' ? record.get({ plain: true }) : record);

const getPaymentCollection = (tenant) => {
  const plain = getPlain(tenant) || {};
  return plain.metadata?.paymentCollection && typeof plain.metadata.paymentCollection === 'object'
    ? plain.metadata.paymentCollection
    : {};
};

const buildTransferReference = (payout) => {
  const suffix = String(payout.id || '').replace(/-/g, '').slice(0, 24);
  return `mp_${suffix}`.slice(0, 50);
};

const normalizePaystackTransferStatus = (value) => String(value || '').trim().toLowerCase();

const isPaystackTransferCompleted = (transfer = {}) => {
  const status = normalizePaystackTransferStatus(transfer.status);
  return status === 'success' && (
    transfer.transferred === true
    || transfer.is_transferred === true
    || Boolean(transfer.transferred_at)
    // Paystack test transfers can return success without a settlement timestamp.
    || transfer.domain === 'test'
  );
};

const verifyCompletedPaystackTransfer = async (reference) => {
  if (!reference) return null;
  const verification = await paystackService.verifyTransfer(reference);
  const transfer = verification?.data || null;
  return isPaystackTransferCompleted(transfer) ? transfer : null;
};

/**
 * Resolve or create a Paystack transfer recipient for marketplace seller payouts.
 * Uses tenant payment collection settings (bank or MoMo), not subaccount splits.
 * @param {import('../models/Tenant').default|object} tenant
 * @returns {Promise<string|null>}
 */
const resolveMarketplaceTransferRecipient = async (tenant) => {
  if (!paystackService.secretKey) return null;

  const plain = getPlain(tenant);
  if (!plain?.id) return null;

  const pc = getPaymentCollection(plain);
  const existingCode = pc.marketplaceTransferRecipientCode || pc.paystackTransferRecipientCode;
  if (existingCode) return existingCode;

  const settlementType = String(pc.settlementType || pc.settlement_type || '').toLowerCase();
  const businessName = String(pc.business_name || plain.name || 'Seller').trim();
  let recipientPayload = null;

  if (settlementType === 'momo' || pc.momoPhone) {
    const momoPhone = String(pc.momoPhone || pc.momo_phone || '').replace(/\s/g, '');
    if (!momoPhone || momoPhone.length < 9) return null;
    const normalizedPhone = momoPhone.replace(/^\+?233/, '0');
    recipientPayload = {
      type: 'mobile_money',
      name: businessName,
      account_number: normalizedPhone,
      bank_code: paystackService.getMoMoBankCode(pc.momoProvider),
      currency: DEFAULT_CURRENCY,
    };
  } else if (settlementType === 'bank' || (pc.bank_code && pc.account_number)) {
    const accountNumber = String(pc.account_number || '').replace(/\s/g, '');
    const bankCode = String(pc.bank_code || '').trim();
    if (!accountNumber || accountNumber.length < 8 || !bankCode) return null;
    recipientPayload = {
      type: 'ghipss',
      name: businessName,
      account_number: accountNumber,
      bank_code: bankCode,
      currency: DEFAULT_CURRENCY,
    };
  } else {
    return null;
  }

  const recipientRes = await paystackService.createTransferRecipient(recipientPayload);
  const recipientCode = recipientRes?.data?.recipient_code;
  if (!recipientCode) return null;

  const tenantRecord = await Tenant.findByPk(plain.id);
  if (tenantRecord) {
    tenantRecord.metadata = tenantRecord.metadata || {};
    tenantRecord.metadata.paymentCollection = {
      ...(tenantRecord.metadata.paymentCollection || {}),
      marketplaceTransferRecipientCode: recipientCode,
    };
    await tenantRecord.save({ fields: ['metadata'] });
  }

  return recipientCode;
};

const markPayoutBlocked = async (payout, reason) => {
  await payout.update({
    metadata: {
      ...(payout.metadata || {}),
      payoutBlockedReason: reason,
      payoutBlockedAt: new Date().toISOString(),
    },
  });
};

/**
 * Initiate a Paystack transfer for one available marketplace payout row.
 * @param {import('../models/MarketplacePayout').default} payout
 * @returns {Promise<{ success: boolean, skipped?: boolean, reason?: string, reference?: string }>}
 */
const processMarketplacePayout = async (payout) => {
  if (!paystackService.secretKey) {
    return { success: false, skipped: true, reason: 'paystack_not_configured' };
  }

  const plain = getPlain(payout);
  if (!plain || plain.status !== 'available') {
    return { success: false, skipped: true, reason: 'not_available' };
  }

  const attempts = Number(plain.metadata?.transferAttempts || 0);
  if (attempts >= MAX_TRANSFER_ATTEMPTS) {
    await markPayoutBlocked(payout, 'max_transfer_attempts_reached');
    return { success: false, skipped: true, reason: 'max_attempts' };
  }

  const tenant = await Tenant.findByPk(plain.tenantId);
  if (!tenant) {
    await markPayoutBlocked(payout, 'tenant_not_found');
    return { success: false, skipped: true, reason: 'tenant_not_found' };
  }

  let recipientCode;
  try {
    recipientCode = await resolveMarketplaceTransferRecipient(tenant);
  } catch (error) {
    console.error(`${LOG_PREFIX} Recipient resolution failed for payout ${plain.id}:`, error?.response?.data || error.message);
    await markPayoutBlocked(payout, 'recipient_resolution_failed');
    return { success: false, reason: 'recipient_resolution_failed' };
  }

  if (!recipientCode) {
    await markPayoutBlocked(payout, 'seller_payout_destination_missing');
    return { success: false, skipped: true, reason: 'no_payout_destination' };
  }

  const amountPesewas = Math.round(money(plain.amount) * 100);
  if (amountPesewas < MIN_TRANSFER_PESEWAS) {
    await markPayoutBlocked(payout, 'transfer_amount_below_minimum');
    return { success: false, skipped: true, reason: 'amount_too_small' };
  }

  const transferReference = plain.metadata?.paystackTransferReference || buildTransferReference(plain);
  const transaction = await sequelize.transaction();
  try {
    const locked = await MarketplacePayout.findOne({
      where: { id: plain.id, status: 'available' },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!locked) {
      await transaction.rollback();
      return { success: false, skipped: true, reason: 'already_processing' };
    }

    await locked.update({
      status: 'processing',
      metadata: {
        ...(locked.metadata || {}),
        paystackTransferReference: transferReference,
        paystackRecipientCode: recipientCode,
        transferAttempts: attempts + 1,
        transferInitiatedAt: new Date().toISOString(),
        payoutBlockedReason: null,
      },
    }, { transaction });
    await transaction.commit();

    const transferResult = await paystackService.initiateTransfer({
      amount: amountPesewas,
      recipient: recipientCode,
      reference: transferReference,
      reason: `Marketplace payout ${locked.payoutNumber}`,
    });

    const transferCode = transferResult?.data?.transfer_code || transferResult?.data?.id || null;
    const initiationStatus = transferResult?.data?.status || 'pending';
    await locked.update({
      metadata: {
        ...(locked.metadata || {}),
        paystackTransferCode: transferCode,
        paystackTransferInitiationStatus: initiationStatus,
        paystackTransferStatus: 'pending',
        paystackTransferMessage: transferResult?.message || null,
        paystackTransferCompleted: false,
      },
    });

    console.log(`${LOG_PREFIX} Transfer initiated`, {
      payoutId: locked.id,
      payoutNumber: locked.payoutNumber,
      reference: transferReference,
      transferCode,
    });

    return { success: true, reference: transferReference, transferCode };
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    const message = paystackService.userFacingPaystackErrorMessage?.(error)
      || error?.response?.data?.message
      || error.message;
    await revertMarketplacePayoutToAvailable({
      payoutId: plain.id,
      reason: message || 'transfer_initiation_failed',
    });
    console.error(`${LOG_PREFIX} Transfer initiation failed for payout ${plain.id}:`, error?.response?.data || message);
    return { success: false, reason: message || 'transfer_initiation_failed' };
  }
};

/**
 * Process a batch of available marketplace payouts.
 * @param {{ limit?: number }} [options]
 * @returns {Promise<{ processed: number, succeeded: number, skipped: number, failed: number, results: object[] }>}
 */
const processAvailableMarketplacePayouts = async ({ limit = DEFAULT_BATCH_LIMIT } = {}) => {
  const payouts = await MarketplacePayout.findAll({
    where: { status: 'available' },
    order: [['releasedAt', 'ASC'], ['createdAt', 'ASC']],
    limit: Math.min(Math.max(Number(limit) || DEFAULT_BATCH_LIMIT, 1), 50),
  });

  const results = [];
  let succeeded = 0;
  let skipped = 0;
  let failed = 0;

  for (const payout of payouts) {
    try {
      const outcome = await processMarketplacePayout(payout);
      results.push({ payoutId: payout.id, ...outcome });
      if (outcome.success) succeeded += 1;
      else if (outcome.skipped) skipped += 1;
      else failed += 1;
    } catch (error) {
      failed += 1;
      results.push({
        payoutId: payout.id,
        success: false,
        reason: error?.message || 'unexpected_error',
      });
      console.error(`${LOG_PREFIX} Unexpected payout processing error:`, error);
    }
  }

  return {
    processed: payouts.length,
    succeeded,
    skipped,
    failed,
    results,
  };
};

const processProcessingMarketplacePayouts = async ({ limit = DEFAULT_BATCH_LIMIT } = {}) => {
  const payouts = await MarketplacePayout.findAll({
    where: { status: 'processing' },
    order: [['updatedAt', 'ASC']],
    limit: Math.min(Math.max(Number(limit) || DEFAULT_BATCH_LIMIT, 1), 50),
  });

  const results = [];
  let completed = 0;

  for (const payout of payouts) {
    const reference = payout.metadata?.paystackTransferReference;
    if (!reference) {
      results.push({ payoutId: payout.id, completed: false, reason: 'missing_reference' });
      continue;
    }

    try {
      const transfer = await verifyCompletedPaystackTransfer(reference);
      if (!transfer) {
        results.push({ payoutId: payout.id, completed: false, reason: 'not_completed' });
        continue;
      }

      await finalizeMarketplacePayoutTransfer({
        payoutId: payout.id,
        transferReference: transfer.reference || reference,
        transferCode: transfer.transfer_code || payout.metadata?.paystackTransferCode || null,
        paidAt: transfer.transferred_at ? new Date(transfer.transferred_at) : new Date(),
        webhookPayload: {
          status: transfer.status,
          amount: transfer.amount,
          recipient: transfer.recipient,
          transferred: transfer.transferred === true || transfer.is_transferred === true,
          transferredAt: transfer.transferred_at || null,
          verified: true,
          source: 'scheduler_verify_transfer',
        },
      });
      completed += 1;
      results.push({ payoutId: payout.id, completed: true });
    } catch (error) {
      results.push({ payoutId: payout.id, completed: false, reason: error?.message || 'verify_failed' });
      console.error(`${LOG_PREFIX} Processing payout verification failed for ${payout.id}:`, error?.response?.data || error.message);
    }
  }

  return {
    processed: payouts.length,
    completed,
    results,
  };
};

const findPayoutForTransferWebhook = async (data = {}) => {
  const reference = data.reference || data.transfer_reference;
  const transferCode = data.transfer_code || data.code || null;

  if (reference) {
    const byReference = await MarketplacePayout.findOne({
      where: sequelize.where(
        sequelize.literal(`"MarketplacePayout"."metadata"->>'paystackTransferReference'`),
        reference,
      ),
    });
    if (byReference) return byReference;
  }

  if (transferCode) {
    const byCode = await MarketplacePayout.findOne({
      where: sequelize.where(
        sequelize.literal(`"MarketplacePayout"."metadata"->>'paystackTransferCode'`),
        String(transferCode),
      ),
    });
    if (byCode) return byCode;
  }

  return null;
};

/**
 * Handle Paystack transfer webhook events for marketplace payouts.
 * @param {string} event
 * @param {object} data
 * @returns {Promise<{ handled: boolean, payoutId?: string, status?: string }>}
 */
const handlePaystackTransferWebhook = async (event, data = {}) => {
  const payout = await findPayoutForTransferWebhook(data);
  if (!payout) {
    return { handled: false };
  }

  const reference = data.reference || payout.metadata?.paystackTransferReference;
  const transferCode = data.transfer_code || data.code || payout.metadata?.paystackTransferCode || null;

  if (event === 'transfer.success') {
    let completedTransfer = null;
    try {
      completedTransfer = await verifyCompletedPaystackTransfer(reference);
    } catch (error) {
      console.error(`${LOG_PREFIX} Transfer verification failed for payout ${payout.id}:`, error?.response?.data || error.message);
    }

    if (!completedTransfer) {
      await payout.update({
        metadata: {
          ...(payout.metadata || {}),
          paystackTransferStatus: normalizePaystackTransferStatus(data.status) || 'pending',
          paystackTransferCompleted: false,
          lastTransferWebhook: {
            status: data.status,
            amount: data.amount,
            recipient: data.recipient,
            verified: false,
          },
        },
      });
      return { handled: true, payoutId: payout.id, status: payout.status };
    }

    await finalizeMarketplacePayoutTransfer({
      payoutId: payout.id,
      transferReference: reference,
      transferCode: completedTransfer.transfer_code || transferCode,
      paidAt: completedTransfer.transferred_at ? new Date(completedTransfer.transferred_at) : new Date(),
      webhookPayload: {
        status: completedTransfer.status,
        amount: completedTransfer.amount,
        recipient: completedTransfer.recipient,
        transferred: completedTransfer.transferred === true || completedTransfer.is_transferred === true,
        transferredAt: completedTransfer.transferred_at || null,
        verified: true,
      },
    });
    console.log(`${LOG_PREFIX} Transfer success recorded for payout ${payout.id}`);
    return { handled: true, payoutId: payout.id, status: 'paid_out' };
  }

  if (event === 'transfer.failed' || event === 'transfer.reversed') {
    const reason = data.reason || data.message || event;
    await revertMarketplacePayoutToAvailable({
      payoutId: payout.id,
      reason,
      webhookEvent: event,
      transferReference: reference,
      transferCode,
    });
    console.warn(`${LOG_PREFIX} Transfer ${event} for payout ${payout.id}:`, reason);
    return { handled: true, payoutId: payout.id, status: 'available' };
  }

  return { handled: false, payoutId: payout.id };
};

module.exports = {
  buildTransferReference,
  handlePaystackTransferWebhook,
  isPaystackTransferCompleted,
  processAvailableMarketplacePayouts,
  processProcessingMarketplacePayouts,
  processMarketplacePayout,
  resolveMarketplaceTransferRecipient,
};
