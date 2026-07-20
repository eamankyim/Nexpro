jest.mock('../../../models', () => ({
  SalesAgent: {
    create: jest.fn(),
    findByPk: jest.fn(),
    findAndCountAll: jest.fn(),
  },
  SalesAgentCode: {
    findOne: jest.fn(),
    create: jest.fn(),
    findByPk: jest.fn(),
  },
  SalesAgentCommission: {
    findOne: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    findAll: jest.fn(),
  },
  Tenant: {
    scope: jest.fn(),
    findAll: jest.fn(),
  },
  SubscriptionPayment: {},
  Setting: {
    findOne: jest.fn(),
  },
}));

const {
  normalizeAgentCode,
  validateAgentCode,
  computeAgentFreeTrialEndsAt,
  applyAgentCodeToTenant,
  maybeCreateCommissionForSuccessfulPayment,
  AGENT_FREE_MONTHS,
  MAX_COMMISSIONS_PER_TENANT,
} = require('../../../services/salesAgentService');

const {
  SalesAgent,
  SalesAgentCode,
  SalesAgentCommission,
  Tenant,
  Setting,
} = require('../../../models');

describe('salesAgentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Tenant.scope.mockImplementation(() => ({
      findByPk: jest.fn(),
      findAll: jest.fn(),
    }));
  });

  describe('normalizeAgentCode', () => {
    it('uppercases and trims valid codes', () => {
      expect(normalizeAgentCode(' sa-ab12 ')).toBe('SA-AB12');
    });

    it('rejects invalid codes', () => {
      expect(normalizeAgentCode('')).toBeNull();
      expect(normalizeAgentCode('ab')).toBeNull();
      expect(normalizeAgentCode('bad code!')).toBeNull();
      expect(normalizeAgentCode(null)).toBeNull();
    });
  });

  describe('validateAgentCode', () => {
    it('returns valid for active agent + active code', async () => {
      SalesAgentCode.findOne.mockResolvedValue({
        code: 'SA-TEST01',
        status: 'active',
        agent: { id: 'agent-1', name: 'Ama Agent', status: 'active' },
      });

      const result = await validateAgentCode('sa-test01');
      expect(result.valid).toBe(true);
      expect(result.code).toBe('SA-TEST01');
      expect(result.freeMonths).toBe(AGENT_FREE_MONTHS);
    });

    it('returns invalid when code not found', async () => {
      SalesAgentCode.findOne.mockResolvedValue(null);
      const result = await validateAgentCode('SA-MISSING');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('AGENT_CODE_NOT_FOUND');
    });
  });

  describe('computeAgentFreeTrialEndsAt', () => {
    it('adds 3 months from the base date', () => {
      const end = computeAgentFreeTrialEndsAt(new Date('2026-01-15T12:00:00.000Z'));
      expect(end.toISOString().slice(0, 10)).toBe('2026-04-15');
    });
  });

  describe('applyAgentCodeToTenant', () => {
    it('attributes tenant and sets 3-month free trial', async () => {
      const tenant = {
        id: 'tenant-1',
        referredByAgentId: null,
        referredByAgentCode: null,
        trialEndsAt: new Date('2026-02-15'),
        plan: 'trial',
        metadata: {},
        update: jest.fn().mockResolvedValue(undefined),
      };

      SalesAgentCode.findOne.mockResolvedValue({
        id: 'code-1',
        code: 'SA-TEST01',
        status: 'active',
        agent: { id: 'agent-1', name: 'Ama', status: 'active', commissionAmount: 5000 },
      });
      Setting.findOne.mockResolvedValue(null);

      const result = await applyAgentCodeToTenant({
        tenant,
        rawCode: 'SA-TEST01',
      });

      expect(result.applied).toBe(true);
      expect(tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          referredByAgentId: 'agent-1',
          referredByAgentCode: 'SA-TEST01',
          trialEndsAt: expect.any(Date),
        }),
        expect.any(Object)
      );
      const trialEndsAt = tenant.update.mock.calls[0][0].trialEndsAt;
      const expected = computeAgentFreeTrialEndsAt();
      expect(Math.abs(trialEndsAt.getTime() - expected.getTime())).toBeLessThan(2000);
    });

    it('skips when code missing and not required', async () => {
      const result = await applyAgentCodeToTenant({
        tenant: { referredByAgentId: null },
        rawCode: '',
      });
      expect(result.applied).toBe(false);
      expect(result.skippedReason).toBe('missing_code');
    });
  });

  describe('maybeCreateCommissionForSuccessfulPayment', () => {
    const payment = {
      id: 'pay-1',
      tenantId: 'tenant-1',
      status: 'success',
      amount: 9900,
      currency: 'GHS',
      plan: 'starter',
      billingPeriod: 'monthly',
      provider: 'manual',
      providerReference: 'ref-1',
    };

    it('creates commission for attributed tenant when under cap', async () => {
      const findByPk = jest.fn().mockResolvedValue({
        id: 'tenant-1',
        referredByAgentId: 'agent-1',
        referredByAgentCode: 'SA-TEST01',
        metadata: {},
      });
      Tenant.scope.mockReturnValue({ findByPk });
      SalesAgent.findByPk.mockResolvedValue({
        id: 'agent-1',
        status: 'active',
        commissionAmount: 5000,
      });
      SalesAgentCommission.findOne.mockResolvedValue(null);
      SalesAgentCommission.count.mockResolvedValue(0);
      SalesAgentCommission.create.mockResolvedValue({
        id: 'comm-1',
        periodNumber: 1,
        amount: 5000,
        status: 'due',
      });

      const result = await maybeCreateCommissionForSuccessfulPayment(payment);
      expect(result.created).toBe(true);
      expect(SalesAgentCommission.create).toHaveBeenCalledWith(
        expect.objectContaining({
          salesAgentId: 'agent-1',
          tenantId: 'tenant-1',
          periodNumber: 1,
          amount: 5000,
          status: 'due',
        }),
        expect.any(Object)
      );
    });

    it('does not create commission when cap of 3 is reached', async () => {
      const findByPk = jest.fn().mockResolvedValue({
        id: 'tenant-1',
        referredByAgentId: 'agent-1',
        referredByAgentCode: 'SA-TEST01',
        metadata: {},
      });
      Tenant.scope.mockReturnValue({ findByPk });
      SalesAgent.findByPk.mockResolvedValue({
        id: 'agent-1',
        status: 'active',
        commissionAmount: 5000,
      });
      SalesAgentCommission.findOne.mockResolvedValue(null);
      SalesAgentCommission.count.mockResolvedValue(MAX_COMMISSIONS_PER_TENANT);

      const result = await maybeCreateCommissionForSuccessfulPayment(payment);
      expect(result.created).toBe(false);
      expect(result.skippedReason).toBe('cap_reached');
      expect(SalesAgentCommission.create).not.toHaveBeenCalled();
    });

    it('does not create commission for zero-amount (non-paid) payments', async () => {
      const result = await maybeCreateCommissionForSuccessfulPayment({
        ...payment,
        amount: 0,
      });
      expect(result.created).toBe(false);
      expect(result.skippedReason).toBe('non_paid_amount');
    });

    it('does not create commission when tenant is not attributed', async () => {
      const findByPk = jest.fn().mockResolvedValue({
        id: 'tenant-1',
        referredByAgentId: null,
      });
      Tenant.scope.mockReturnValue({ findByPk });

      const result = await maybeCreateCommissionForSuccessfulPayment(payment);
      expect(result.created).toBe(false);
      expect(result.skippedReason).toBe('not_attributed');
    });
  });
});
