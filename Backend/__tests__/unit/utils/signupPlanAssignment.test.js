const dayjs = require('dayjs');
const {
  MOBILE_FREE_PLAN_ID,
  MOBILE_FREE_ACCESS_MONTHS,
  isMobileSignupClient,
  buildWebTrialAssignment,
  resolveSignupPlanAssignment,
  buildSignupSubscriptionSettingValue,
} = require('../../../utils/signupPlanAssignment');

describe('signupPlanAssignment', () => {
  describe('isMobileSignupClient', () => {
    it('detects X-Client: mobile', () => {
      expect(isMobileSignupClient({ headers: { 'x-client': 'mobile' }, body: {} })).toBe(true);
    });

    it('detects X-App: abs-mobile', () => {
      expect(isMobileSignupClient({ headers: { 'x-app': 'abs-mobile' }, body: {} })).toBe(true);
    });

    it('detects body.client mobile flag', () => {
      expect(isMobileSignupClient({ headers: {}, body: { client: 'mobile' } })).toBe(true);
    });

    it('does not treat web / missing headers as mobile', () => {
      expect(isMobileSignupClient({ headers: { 'user-agent': 'Mozilla' }, body: {} })).toBe(false);
      expect(isMobileSignupClient({ headers: {}, body: {} })).toBe(false);
      expect(isMobileSignupClient(null)).toBe(false);
    });
  });

  describe('buildWebTrialAssignment', () => {
    it('assigns trial with ~1 month access', () => {
      const at = new Date('2026-06-15T12:00:00.000Z');
      const assignment = buildWebTrialAssignment({ at });
      expect(assignment.channel).toBe('web');
      expect(assignment.planId).toBe('trial');
      expect(assignment.subscriptionStatus).toBe('trialing');
      expect(dayjs(assignment.trialEndsAt).diff(at, 'month')).toBe(1);
    });
  });

  describe('resolveSignupPlanAssignment', () => {
    const at = new Date('2026-06-15T12:00:00.000Z');

    it('returns web trial when not mobile', async () => {
      const SubscriptionPlan = { findOne: jest.fn() };
      const assignment = await resolveSignupPlanAssignment({
        req: { headers: {}, body: {} },
        SubscriptionPlan,
        at,
      });
      expect(assignment.planId).toBe('trial');
      expect(assignment.channel).toBe('web');
      expect(SubscriptionPlan.findOne).not.toHaveBeenCalled();
    });

    it('assigns free_plan with 12-month access for mobile when plan exists', async () => {
      const SubscriptionPlan = {
        findOne: jest.fn().mockResolvedValue({
          id: 'plan-row-1',
          planId: MOBILE_FREE_PLAN_ID,
          name: 'Free',
          isActive: true,
        }),
      };
      const assignment = await resolveSignupPlanAssignment({
        req: { headers: { 'x-client': 'mobile' }, body: {} },
        SubscriptionPlan,
        at,
      });
      expect(assignment.channel).toBe('mobile');
      expect(assignment.planId).toBe(MOBILE_FREE_PLAN_ID);
      expect(assignment.subscriptionStatus).toBe('active');
      expect(assignment.planId).not.toBe('free');
      expect(dayjs(assignment.accessEndsAt).diff(at, 'month')).toBe(MOBILE_FREE_ACCESS_MONTHS);
      expect(assignment.trialEndsAt).toEqual(assignment.accessEndsAt);
      expect(assignment.metadataExtras.signupChannel).toBe('mobile');
      expect(SubscriptionPlan.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { planId: MOBILE_FREE_PLAN_ID, isActive: true },
        })
      );
    });

    it('falls back to trial when free_plan missing (default)', async () => {
      const SubscriptionPlan = { findOne: jest.fn().mockResolvedValue(null) };
      const assignment = await resolveSignupPlanAssignment({
        req: { headers: { 'x-client': 'mobile' }, body: {} },
        SubscriptionPlan,
        at,
      });
      expect(assignment.planId).toBe('trial');
      expect(assignment.metadataExtras.planAssignmentFallback).toBe('trial_missing_free_plan');
      expect(assignment.metadataExtras.signupChannel).toBe('mobile');
    });

    it('throws FREE_PLAN_NOT_CONFIGURED when fallback disabled', async () => {
      const SubscriptionPlan = { findOne: jest.fn().mockResolvedValue(null) };
      await expect(
        resolveSignupPlanAssignment({
          req: { headers: { 'x-client': 'mobile' }, body: {} },
          SubscriptionPlan,
          at,
          options: { allowMissingFreePlanFallback: false },
        })
      ).rejects.toMatchObject({ errorCode: 'FREE_PLAN_NOT_CONFIGURED', statusCode: 503 });
    });
  });

  describe('buildSignupSubscriptionSettingValue', () => {
    it('marks mobile free as active complimentary', () => {
      const at = new Date('2026-06-15T12:00:00.000Z');
      const accessEndsAt = dayjs(at).add(12, 'month').toDate();
      const value = buildSignupSubscriptionSettingValue({
        channel: 'mobile',
        planId: MOBILE_FREE_PLAN_ID,
        subscriptionStatus: 'active',
        accessEndsAt,
        trialEndsAt: accessEndsAt,
      });
      expect(value).toMatchObject({
        plan: MOBILE_FREE_PLAN_ID,
        status: 'active',
        complimentary: true,
      });
    });
  });
});
