jest.mock('../../../models', () => ({
  SubscriptionPayment: { findOne: jest.fn().mockResolvedValue(null), create: jest.fn() },
  Setting: { findOne: jest.fn().mockResolvedValue(null), findOrCreate: jest.fn() },
  Tenant: {
    scope: () => ({
      findByPk: jest.fn(),
    }),
    findByPk: jest.fn(),
  },
}));

const {
  resolveBillingStatus,
  normalizePlan,
  addPeriod,
  DEFAULT_GRACE_DAYS,
} = require('../../../services/subscriptionBillingService');

const baseTenant = (overrides = {}) => ({
  id: 'tenant-1',
  plan: 'trial',
  status: 'active',
  trialEndsAt: new Date('2030-01-15'),
  metadata: { entitlements: {} },
  ...overrides,
});

describe('subscriptionBillingService', () => {
  describe('normalizePlan', () => {
    it('lowercases plan ids', () => {
      expect(normalizePlan(' Starter ')).toBe('starter');
    });
  });

  describe('addPeriod', () => {
    it('adds one month for monthly billing', () => {
      const start = new Date('2026-01-01');
      const end = addPeriod(start, 'monthly');
      expect(end.getMonth()).toBe(1);
    });
  });

  describe('resolveBillingStatus', () => {
    it('returns trialing when trial has not ended', async () => {
      const billing = await resolveBillingStatus(baseTenant(), {
        at: new Date('2026-01-01'),
        subscriptionSetting: {},
      });
      expect(billing.billingStatus).toBe('trialing');
      expect(billing.canAccessApp).toBe(true);
    });

    it('returns manual_override when billingOverride is unlocked', async () => {
      const billing = await resolveBillingStatus(
        baseTenant({
          trialEndsAt: new Date('2020-01-01'),
          metadata: { entitlements: { billingOverride: 'unlocked' } },
        }),
        { at: new Date('2026-01-01'), subscriptionSetting: {} }
      );
      expect(billing.billingStatus).toBe('manual_override');
      expect(billing.canAccessApp).toBe(true);
    });

    it('keeps enterprise active without ledger payment', async () => {
      const billing = await resolveBillingStatus(
        baseTenant({
          plan: 'enterprise',
          trialEndsAt: new Date('2020-01-01'),
        }),
        { at: new Date('2026-01-01'), subscriptionSetting: {} }
      );
      expect(billing.billingStatus).toBe('active');
      expect(billing.canAccessApp).toBe(true);
      expect(billing.plan).toBe('enterprise');
    });

    it('locks enterprise when billingOverride is locked', async () => {
      const billing = await resolveBillingStatus(
        baseTenant({
          plan: 'enterprise',
          metadata: { entitlements: { billingOverride: 'locked' } },
        }),
        { at: new Date('2026-01-01'), subscriptionSetting: {} }
      );
      expect(billing.billingStatus).toBe('locked');
      expect(billing.canAccessApp).toBe(false);
      expect(billing.lockReason).toBe('platform_locked');
    });

    it('returns locked after trial and grace', async () => {
      const trialEndsAt = new Date('2026-01-01');
      const at = new Date(trialEndsAt);
      at.setDate(at.getDate() + DEFAULT_GRACE_DAYS + 1);
      const billing = await resolveBillingStatus(baseTenant({ trialEndsAt }), {
        at,
        subscriptionSetting: {},
      });
      expect(billing.billingStatus).toBe('locked');
      expect(billing.canAccessApp).toBe(false);
      expect(billing.lockReason).toBe('trial_expired');
    });

    it('returns unknown when tenant object has no id (avoids undefined tenantId queries)', async () => {
      const { Setting, SubscriptionPayment } = require('../../../models');
      Setting.findOne.mockClear();
      SubscriptionPayment.findOne.mockClear();

      const billing = await resolveBillingStatus({
        plan: 'trial',
        trialEndsAt: new Date('2030-01-01'),
        status: 'active',
        metadata: {},
      });

      expect(billing.billingStatus).toBe('unknown');
      expect(billing.lockReason).toBe('tenant_not_found');
      expect(Setting.findOne).not.toHaveBeenCalled();
      expect(SubscriptionPayment.findOne).not.toHaveBeenCalled();
    });
  });
});
