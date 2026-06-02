jest.mock('../../../services/paystackService', () => ({
  secretKey: 'sk_test_123',
  initializeTransaction: jest.fn(),
  verifyTransaction: jest.fn(),
}));

jest.mock('../../../config/paystackPlans', () => ({
  isContactSalesPlan: jest.fn(() => false),
}));

jest.mock('../../../services/subscriptionPlanCatalogService', () => ({
  resolvePaidPlanPricing: jest.fn(),
}));

jest.mock('../../../services/subscriptionBillingService', () => ({
  normalizePlan: jest.fn((plan) => String(plan || '').trim().toLowerCase()),
  normalizeBillingPeriod: jest.fn((period) =>
    String(period || '').trim().toLowerCase() === 'yearly' ? 'yearly' : 'monthly'
  ),
  resolveBillingStatus: jest.fn(),
  applySubscriptionFromPaystackTransaction: jest.fn(),
  getActivePaymentForTenant: jest.fn(),
}));

jest.mock('../../../models', () => ({
  SubscriptionPayment: { findAll: jest.fn() },
}));

const paystackService = require('../../../services/paystackService');
const { resolvePaidPlanPricing } = require('../../../services/subscriptionPlanCatalogService');
const subscriptionController = require('../../../controllers/subscriptionController');

const createResponse = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

describe('subscriptionController initializeSubscriptionPayment', () => {
  const baseReq = () => ({
    tenantId: 'tenant-123456789',
    user: { id: 'user-1', email: 'owner@example.com' },
    body: { plan: 'starter', billingPeriod: 'monthly' },
  });

  beforeEach(() => {
    jest.clearAllMocks();
    paystackService.secretKey = 'sk_test_123';
    resolvePaidPlanPricing.mockResolvedValue({
      amountPesewas: 12900,
      planCode: 'PLN_starter_monthly',
      featureKeys: ['sales'],
    });
    paystackService.initializeTransaction.mockResolvedValue({
      status: true,
      data: {
        authorization_url: 'https://checkout.paystack.com/test',
        access_code: 'access-code',
        reference: 'SUB_ref',
      },
    });
  });

  it('uses card channels and the Paystack plan by default', async () => {
    const req = baseReq();
    const res = createResponse();
    const next = jest.fn();

    await subscriptionController.initializeSubscriptionPayment(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(paystackService.initializeTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'owner@example.com',
        plan: 'PLN_starter_monthly',
        channels: ['card'],
        metadata: expect.objectContaining({
          type: 'subscription',
          tenantId: 'tenant-123456789',
          plan: 'starter',
          billingPeriod: 'monthly',
          paymentMethod: 'card',
        }),
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('uses amount-based mobile money checkout when requested', async () => {
    const req = {
      ...baseReq(),
      body: { plan: 'starter', billingPeriod: 'monthly', paymentMethod: 'mobile_money' },
    };
    const res = createResponse();
    const next = jest.fn();

    await subscriptionController.initializeSubscriptionPayment(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(paystackService.initializeTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 12900,
        channels: ['mobile_money'],
        metadata: expect.objectContaining({
          paymentMethod: 'mobile_money',
          paystackPlanCode: 'PLN_starter_monthly',
        }),
      })
    );
    expect(paystackService.initializeTransaction.mock.calls[0][0]).not.toHaveProperty('plan');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns a clear setup message when Paystack rejects mobile money checkout', async () => {
    const req = {
      ...baseReq(),
      body: { plan: 'starter', billingPeriod: 'monthly', paymentMethod: 'mobile_money' },
    };
    const res = createResponse();
    const next = jest.fn();
    paystackService.initializeTransaction.mockRejectedValueOnce(
      Object.assign(new Error('Forbidden'), { response: { status: 403 } })
    );

    await subscriptionController.initializeSubscriptionPayment(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: expect.stringContaining('Mobile money checkout is not enabled'),
      })
    );
  });
});
