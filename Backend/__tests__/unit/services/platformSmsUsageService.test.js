jest.mock('../../../config/database', () => ({
  sequelize: {
    query: jest.fn(),
  },
}));

jest.mock('../../../services/platformSmsSettingsService', () => ({
  getSavedPlatformSmsConfig: jest.fn(),
  parseMonthlyLimit: jest.fn((value) => {
    const parsed = parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 1) return 100;
    return parsed;
  }),
}));

const { sequelize } = require('../../../config/database');
const { getSavedPlatformSmsConfig } = require('../../../services/platformSmsSettingsService');
const platformSmsUsageService = require('../../../services/platformSmsUsageService');

describe('platformSmsUsageService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getSavedPlatformSmsConfig.mockResolvedValue({ monthlyLimit: 100 });
  });

  it('returns usage summary with remaining quota', async () => {
    sequelize.query.mockResolvedValueOnce([[{ sentCount: 25 }]]);

    const summary = await platformSmsUsageService.getTenantUsageSummary('tenant-1');

    expect(summary.sentCount).toBe(25);
    expect(summary.monthlyLimit).toBe(100);
    expect(summary.remaining).toBe(75);
    expect(summary.yearMonth).toMatch(/^\d{4}-\d{2}$/);
  });

  it('blocks sends when monthly limit would be exceeded', async () => {
    sequelize.query.mockResolvedValueOnce([[{ sentCount: 100 }]]);

    const result = await platformSmsUsageService.checkPlatformSmsLimit('tenant-1', 1);

    expect(result.allowed).toBe(false);
    expect(result.errorCode).toBe('PLATFORM_SMS_MONTHLY_LIMIT');
  });

  it('returns zero usage when usage table is missing', async () => {
    sequelize.query.mockRejectedValueOnce(
      Object.assign(new Error('relation "tenant_platform_sms_usage" does not exist'), {
        parent: { code: '42P01' },
      })
    );

    const summary = await platformSmsUsageService.getTenantUsageSummary('tenant-1');

    expect(summary.sentCount).toBe(0);
    expect(summary.remaining).toBe(100);
  });

  it('atomically increments usage after successful send', async () => {
    sequelize.query.mockResolvedValueOnce([[{ sentCount: 3 }]]);

    const newCount = await platformSmsUsageService.incrementPlatformSmsUsage('tenant-1', 1);

    expect(newCount).toBe(3);
    expect(sequelize.query).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT (tenant_id, year_month)'),
      expect.objectContaining({
        replacements: expect.objectContaining({
          tenantId: 'tenant-1',
          incrementBy: 1,
        }),
      })
    );
  });
});
