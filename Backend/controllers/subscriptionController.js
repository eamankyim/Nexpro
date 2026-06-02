const crypto = require('crypto');
const paystackService = require('../services/paystackService');
const { isContactSalesPlan } = require('../config/paystackPlans');
const {
  resolvePaidPlanPricing,
} = require('../services/subscriptionPlanCatalogService');
const {
  normalizePlan,
  normalizeBillingPeriod,
  resolveBillingStatus,
  applySubscriptionFromPaystackTransaction,
  getActivePaymentForTenant,
} = require('../services/subscriptionBillingService');
const { SubscriptionPayment } = require('../models');

// @desc    Initialize subscription payment
// @route   POST /api/subscription/initialize
// @access  Private (admin/manager)
exports.initializeSubscriptionPayment = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const user = req.user;
    const plan = normalizePlan(req.body?.plan);
    const billingPeriod = normalizeBillingPeriod(req.body?.billingPeriod);
    const paymentMethod = String(req.body?.paymentMethod || 'card').trim().toLowerCase();

    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant context is required' });
    }
    if (!user?.email) {
      return res.status(400).json({ success: false, message: 'User email is required' });
    }
    if (plan === 'enterprise' || isContactSalesPlan(plan)) {
      return res.status(400).json({
        success: false,
        message: 'Enterprise plans require contacting sales. We will set up billing manually.',
      });
    }
    if (!['starter', 'professional'].includes(plan)) {
      return res.status(400).json({ success: false, message: 'Invalid plan selected' });
    }
    if (!['card', 'mobile_money'].includes(paymentMethod)) {
      return res.status(400).json({ success: false, message: 'Invalid payment method selected' });
    }
    if (!paystackService.secretKey) {
      return res.status(503).json({ success: false, message: 'Payment provider is not configured' });
    }

    const pricing = await resolvePaidPlanPricing(plan, billingPeriod);
    if (!pricing?.amountPesewas) {
      return res.status(400).json({
        success: false,
        message: 'Could not resolve plan pricing. Sync Paystack plans in platform settings.',
      });
    }

    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
    const callbackUrl = `${frontendUrl}/checkout`;

    const usePaystackPlan = paymentMethod === 'card' && pricing.planCode;
    const initPayload = {
      email: user.email,
      callback_url: callbackUrl,
      reference: `SUB_${tenantId.slice(0, 8)}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      metadata: {
        type: 'subscription',
        tenantId,
        userId: user.id,
        plan,
        billingPeriod,
        paystackPlanCode: pricing.planCode || null,
        amountPesewas: pricing.amountPesewas,
        paymentMethod,
        featureKeys: pricing.featureKeys || [],
      },
      channels: paymentMethod === 'mobile_money' ? ['mobile_money'] : ['card'],
    };
    if (usePaystackPlan) {
      initPayload.plan = pricing.planCode;
    } else {
      initPayload.amount = pricing.amountPesewas;
    }

    let result;
    try {
      result = await paystackService.initializeTransaction(initPayload);
    } catch (paystackErr) {
      const status = paystackErr?.response?.status;
      if (paymentMethod === 'mobile_money' && [400, 403].includes(status)) {
        return res.status(400).json({
          success: false,
          message:
            'Mobile money checkout is not enabled for this Paystack account or currency. Enable Paystack Mobile Money for Ghana payments, or pay by card.',
        });
      }
      throw paystackErr;
    }

    if (!result?.status || !result?.data?.authorization_url) {
      return res.status(502).json({ success: false, message: result?.message || 'Failed to initialize payment' });
    }

    return res.status(200).json({
      success: true,
      data: {
        authorization_url: result.data.authorization_url,
        access_code: result.data.access_code,
        reference: result.data.reference || initPayload.reference,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify subscription payment and activate subscription
// @route   GET /api/subscription/verify/:reference
// @access  Private (admin/manager)
exports.verifySubscriptionPayment = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { reference } = req.params;

    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant context is required' });
    }
    if (!reference) {
      return res.status(400).json({ success: false, message: 'Payment reference is required' });
    }
    if (!paystackService.secretKey) {
      return res.status(503).json({ success: false, message: 'Payment provider is not configured' });
    }

    const result = await paystackService.verifyTransaction(reference);
    const paymentData = result?.data || {};

    if (!result?.status || paymentData?.status !== 'success') {
      return res.status(400).json({
        success: false,
        message: result?.message || 'Payment verification failed',
      });
    }

    const metadata = paymentData?.metadata || {};
    if (metadata?.tenantId && metadata.tenantId !== tenantId) {
      return res.status(403).json({ success: false, message: 'Payment does not belong to this tenant' });
    }

    const activation = await applySubscriptionFromPaystackTransaction(paymentData, 'verify');
    if (!activation) {
      return res.status(400).json({
        success: false,
        message: 'Payment was successful but could not be applied as a subscription',
      });
    }

    const billing = await resolveBillingStatus(req.tenant);

    return res.status(200).json({
      success: true,
      message: activation.alreadyRecorded
        ? 'Payment already recorded for this subscription'
        : 'Payment verified successfully',
      data: {
        reference,
        status: paymentData?.status,
        plan: activation.payment.plan,
        billingPeriod: activation.payment.billingPeriod,
        currentPeriodEnd: activation.payment.periodEnd,
        alreadyRecorded: activation.alreadyRecorded,
        billing,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Used by Paystack webhook (charge.success).
 * @param {object} paymentData
 * @param {string} [source]
 */
exports.applySubscriptionFromTransaction = async (paymentData, source = 'webhook') => {
  return applySubscriptionFromPaystackTransaction(paymentData, source);
};

// @desc    Billing status for active tenant
// @route   GET /api/subscription/status
// @access  Private
exports.getSubscriptionStatus = async (req, res, next) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant context is required' });
    }
    const billing = await resolveBillingStatus(req.tenant);
    return res.status(200).json({ success: true, data: billing });
  } catch (error) {
    next(error);
  }
};

// @desc    Payment history for active tenant
// @route   GET /api/subscription/payments
// @access  Private (admin/manager)
exports.getSubscriptionPayments = async (req, res, next) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant context is required' });
    }
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const payments = await SubscriptionPayment.findAll({
      where: { tenantId: req.tenantId },
      order: [['createdAt', 'DESC']],
      limit,
    });
    const activePayment = await getActivePaymentForTenant(req.tenantId);
    const billing = await resolveBillingStatus(req.tenant);
    return res.status(200).json({
      success: true,
      data: { payments, activePayment, billing },
    });
  } catch (error) {
    next(error);
  }
};
