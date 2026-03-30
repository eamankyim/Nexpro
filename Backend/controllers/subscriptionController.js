const crypto = require('crypto');
const { Setting, Tenant } = require('../models');
const paystackService = require('../services/paystackService');
const { PLAN_DEFINITIONS } = require('../config/paystackPlans');

const normalizePlan = (plan = '') => String(plan).trim().toLowerCase();
const normalizeBillingPeriod = (value = '') =>
  String(value).trim().toLowerCase() === 'yearly' ? 'yearly' : 'monthly';

const getPlanAmount = (plan, billingPeriod) => {
  const definition = PLAN_DEFINITIONS[plan];
  if (!definition || definition.contactSales) return null;
  return billingPeriod === 'yearly' ? definition.yearly : definition.monthly;
};

const getCurrentPeriodEnd = (billingPeriod) => {
  const dt = new Date();
  if (billingPeriod === 'yearly') dt.setFullYear(dt.getFullYear() + 1);
  else dt.setMonth(dt.getMonth() + 1);
  return dt;
};

// @desc    Initialize subscription payment
// @route   POST /api/subscription/initialize
// @access  Private (admin/manager)
exports.initializeSubscriptionPayment = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const user = req.user;
    const plan = normalizePlan(req.body?.plan);
    const billingPeriod = normalizeBillingPeriod(req.body?.billingPeriod);

    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant context is required' });
    }
    if (!user?.email) {
      return res.status(400).json({ success: false, message: 'User email is required' });
    }
    if (!['starter', 'professional'].includes(plan)) {
      return res.status(400).json({ success: false, message: 'Invalid plan selected' });
    }
    if (!paystackService.secretKey) {
      return res.status(503).json({ success: false, message: 'Payment provider is not configured' });
    }

    const amount = getPlanAmount(plan, billingPeriod);
    if (!amount) {
      return res.status(400).json({ success: false, message: 'Could not resolve plan pricing' });
    }

    const reference = `SUB_${tenantId.slice(0, 8)}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
    const callbackUrl = `${frontendUrl}/checkout`;

    const result = await paystackService.initializeTransaction({
      email: user.email,
      amount,
      callback_url: callbackUrl,
      reference,
      metadata: {
        type: 'subscription',
        tenantId,
        userId: user.id,
        plan,
        billingPeriod
      },
      channels: ['card']
    });

    if (!result?.status || !result?.data?.authorization_url) {
      return res.status(502).json({ success: false, message: result?.message || 'Failed to initialize payment' });
    }

    return res.status(200).json({
      success: true,
      data: {
        authorization_url: result.data.authorization_url,
        access_code: result.data.access_code,
        reference: result.data.reference || reference
      }
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
        message: result?.message || 'Payment verification failed'
      });
    }

    const metadata = paymentData?.metadata || {};
    if (metadata?.tenantId && metadata.tenantId !== tenantId) {
      return res.status(403).json({ success: false, message: 'Payment does not belong to this tenant' });
    }

    const plan = normalizePlan(metadata?.plan || 'starter');
    const billingPeriod = normalizeBillingPeriod(metadata?.billingPeriod || 'monthly');
    const currentPeriodEnd = getCurrentPeriodEnd(billingPeriod);

    const [setting] = await Setting.findOrCreate({
      where: { tenantId, key: 'subscription' },
      defaults: {
        tenantId,
        key: 'subscription',
        value: {},
        description: 'Subscription and billing information'
      }
    });

    const prev = setting.value || {};
    const history = Array.isArray(prev.history) ? prev.history : [];
    history.unshift({
      at: new Date().toISOString(),
      event: 'payment_verified',
      reference,
      amount: paymentData?.amount,
      plan,
      billingPeriod,
      channel: paymentData?.channel || null
    });

    const nextValue = {
      ...prev,
      plan,
      status: 'active',
      billingPeriod,
      currentPeriodEnd: currentPeriodEnd.toISOString(),
      lastPaymentReference: reference,
      paymentMethod: paymentData?.channel || prev.paymentMethod || null,
      history: history.slice(0, 100)
    };

    await setting.update({ value: nextValue });
    await Tenant.update({ plan, status: 'active' }, { where: { id: tenantId } });

    return res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      data: {
        reference,
        status: paymentData?.status,
        plan,
        billingPeriod,
        currentPeriodEnd: nextValue.currentPeriodEnd
      }
    });
  } catch (error) {
    next(error);
  }
};
