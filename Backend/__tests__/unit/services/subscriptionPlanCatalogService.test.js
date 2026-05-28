const {
  classifyPaystackPlan,
  pickCanonicalPaystackPlans,
  buildEnterprisePaymentMetadata,
} = require('../../../services/subscriptionPlanCatalogService');

describe('subscriptionPlanCatalogService', () => {
  describe('classifyPaystackPlan', () => {
    it('matches canonical starter monthly', () => {
      const result = classifyPaystackPlan({
        name: 'Starter (Monthly)',
        amount: 12900,
        interval: 'monthly',
        currency: 'GHS',
        plan_code: 'PLN_a',
      });
      expect(result.kind).toBe('canonical');
      expect(result.planId).toBe('starter');
      expect(result.billingPeriod).toBe('monthly');
    });

    it('ignores legacy professional duplicate amounts', () => {
      const result = classifyPaystackPlan({
        name: 'Professional (Monthly)',
        amount: 19900,
        interval: 'monthly',
        currency: 'GHS',
      });
      expect(result.kind).toBe('ignored');
      expect(result.reason).toBe('legacy_duplicate_amount');
    });

    it('ignores enterprise Paystack subscription rows', () => {
      const result = classifyPaystackPlan({
        name: 'Enterprise (Monthly)',
        amount: 50000,
        interval: 'monthly',
        currency: 'GHS',
      });
      expect(result.kind).toBe('ignored');
      expect(result.reason).toBe('enterprise_manual_only');
    });

    it('ignores wrong amount for canonical name', () => {
      const result = classifyPaystackPlan({
        name: 'Professional (Yearly)',
        amount: 191000,
        interval: 'annually',
        currency: 'GHS',
      });
      expect(result.kind).toBe('ignored');
    });
  });

  describe('pickCanonicalPaystackPlans', () => {
    it('dedupes duplicate canonical slots', () => {
      const { canonical, ignored } = pickCanonicalPaystackPlans([
        {
          id: 1,
          name: 'Starter (Monthly)',
          amount: 12900,
          interval: 'monthly',
          currency: 'GHS',
          plan_code: 'PLN_old',
          status: 'inactive',
        },
        {
          id: 2,
          name: 'Starter (Monthly)',
          amount: 12900,
          interval: 'monthly',
          currency: 'GHS',
          plan_code: 'PLN_new',
          status: 'active',
        },
      ]);
      expect(canonical).toHaveLength(1);
      expect(canonical[0].row.plan_code).toBe('PLN_new');
      expect(ignored.some((i) => i.reason === 'duplicate_canonical_slot')).toBe(true);
    });
  });

  describe('buildEnterprisePaymentMetadata', () => {
    it('sets cloud renewal one year after license payment', () => {
      const at = new Date('2026-05-28T12:00:00.000Z');
      const meta = buildEnterprisePaymentMetadata({
        enterpriseTier: 'starter',
        paymentType: 'enterprise_license',
        at,
      });
      expect(meta.paymentType).toBe('enterprise_license');
      expect(meta.licenseFeeGhs).toBe(10000);
      expect(meta.cloudPlanAnnualGhs).toBe(600);
      expect(new Date(meta.cloudRenewalStartsAt).getFullYear()).toBe(2027);
      expect(new Date(meta.cloudNextDueAt).getFullYear()).toBe(2027);
    });

    it('extends cloud renewal on renewal payment', () => {
      const meta = buildEnterprisePaymentMetadata({
        enterpriseTier: 'business',
        paymentType: 'enterprise_cloud_renewal',
        existingCloudNextDueAt: '2027-06-01T00:00:00.000Z',
        at: new Date('2027-05-01T00:00:00.000Z'),
      });
      expect(meta.paymentType).toBe('enterprise_cloud_renewal');
      expect(new Date(meta.cloudNextDueAt).getFullYear()).toBe(2028);
      expect(meta.suggestedAmountGhs).toBe(1200);
    });
  });
});
