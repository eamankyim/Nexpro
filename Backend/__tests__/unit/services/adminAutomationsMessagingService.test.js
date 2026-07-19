jest.mock('../../../config/database', () => ({
  sequelize: {
    query: jest.fn(),
  },
}));

jest.mock('../../../models', () => ({
  AutomationRule: { count: jest.fn() },
  AutomationRun: { count: jest.fn() },
  Tenant: {},
}));

jest.mock('../../../services/platformSmsUsageService', () => ({
  getCurrentYearMonth: jest.fn(() => '2026-07'),
  getNextResetAt: jest.fn(() => '2026-08-01T00:00:00.000Z'),
  getMonthlyLimit: jest.fn(async () => 100),
}));

jest.mock('../../../services/platformSmsSettingsService', () => ({
  testPlatformSmsConnection: jest.fn(),
}));

const {
  deriveRuleStatus,
  countSuccessfulChannelActions,
  aggregateChannelCountsFromRuns,
  computeSmsUsageMetrics,
  resolvePeriodBounds,
  sanitizeBalancePayload,
} = require('../../../services/adminAutomationsMessagingService');

describe('adminAutomationsMessagingService aggregation', () => {
  describe('deriveRuleStatus', () => {
    it('returns paused when disabled', () => {
      expect(deriveRuleStatus(false, 'failed')).toBe('paused');
      expect(deriveRuleStatus(false, null)).toBe('paused');
    });

    it('returns waiting when enabled with no runs', () => {
      expect(deriveRuleStatus(true, null)).toBe('waiting');
      expect(deriveRuleStatus(true, undefined)).toBe('waiting');
    });

    it('returns failed when last run failed', () => {
      expect(deriveRuleStatus(true, 'failed')).toBe('failed');
    });

    it('returns active for successful last run', () => {
      expect(deriveRuleStatus(true, 'success')).toBe('active');
      expect(deriveRuleStatus(true, 'skipped')).toBe('active');
    });
  });

  describe('countSuccessfulChannelActions', () => {
    it('counts only success=true messaging actions', () => {
      const counts = countSuccessfulChannelActions([
        { type: 'send_sms', success: true },
        { type: 'send_sms', success: false },
        { type: 'send_email_platform', success: true },
        { type: 'send_whatsapp', success: true },
        { type: 'send_whatsapp', success: true },
        { type: 'create_task', success: true },
        { type: 'send_email_platform' }, // missing success — not counted
      ]);
      expect(counts).toEqual({ sms: 1, email: 1, whatsapp: 2 });
    });

    it('handles empty or invalid results', () => {
      expect(countSuccessfulChannelActions(null)).toEqual({ sms: 0, email: 0, whatsapp: 0 });
      expect(countSuccessfulChannelActions(undefined)).toEqual({ sms: 0, email: 0, whatsapp: 0 });
      expect(countSuccessfulChannelActions([])).toEqual({ sms: 0, email: 0, whatsapp: 0 });
    });
  });

  describe('aggregateChannelCountsFromRuns', () => {
    it('sums channel successes across runs', () => {
      const totals = aggregateChannelCountsFromRuns([
        {
          resultSummary: {
            results: [
              { type: 'send_sms', success: true },
              { type: 'send_email_platform', success: true },
            ],
          },
        },
        {
          resultSummary: {
            results: [{ type: 'send_whatsapp', success: true }],
          },
        },
        { resultSummary: {} },
      ]);
      expect(totals).toEqual({ sms: 1, email: 1, whatsapp: 1 });
    });
  });

  describe('computeSmsUsageMetrics', () => {
    it('computes remaining and percent used', () => {
      expect(computeSmsUsageMetrics(25, 100)).toEqual({
        sentCount: 25,
        monthlyLimit: 100,
        remaining: 75,
        percentUsed: 25,
      });
    });

    it('clamps remaining at zero when over limit', () => {
      expect(computeSmsUsageMetrics(120, 100)).toEqual({
        sentCount: 120,
        monthlyLimit: 100,
        remaining: 0,
        percentUsed: 100,
      });
    });
  });

  describe('resolvePeriodBounds', () => {
    it('defaults to last 30 days ending at to/now', () => {
      const to = new Date('2026-07-11T12:00:00.000Z');
      const { from, to: toDate } = resolvePeriodBounds({ to: to.toISOString(), defaultDays: 30 });
      expect(toDate.toISOString()).toBe(to.toISOString());
      const expectedFrom = new Date(to);
      expectedFrom.setDate(expectedFrom.getDate() - 30);
      expect(from.toISOString()).toBe(expectedFrom.toISOString());
    });

    it('uses explicit from/to when provided', () => {
      const { from, to } = resolvePeriodBounds({
        from: '2026-06-01T00:00:00.000Z',
        to: '2026-06-30T23:59:59.000Z',
      });
      expect(from.toISOString()).toBe('2026-06-01T00:00:00.000Z');
      expect(to.toISOString()).toBe('2026-06-30T23:59:59.000Z');
    });
  });

  describe('sanitizeBalancePayload', () => {
    it('exposes balance fields without secrets', () => {
      expect(sanitizeBalancePayload({
        sms_balance: 42.5,
        main_balance: 100,
        api_key: 'secret',
      })).toEqual({
        smsBalance: 42.5,
        mainBalance: 100,
        currency: null,
        bonus: null,
        raw: { sms_balance: 42.5, main_balance: 100, bonus: null },
      });
    });

    it('returns null for invalid input', () => {
      expect(sanitizeBalancePayload(null)).toBeNull();
      expect(sanitizeBalancePayload('x')).toBeNull();
    });
  });
});
