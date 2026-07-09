jest.mock('../../../models', () => ({
  Setting: {
    findOne: jest.fn(),
  },
}));

jest.mock('../../../services/platformSmsSettingsService', () => ({
  getSavedPlatformSmsConfig: jest.fn(),
}));

jest.mock('../../../services/platformSmsUsageService', () => ({
  checkPlatformSmsLimit: jest.fn(),
  incrementPlatformSmsUsage: jest.fn(),
}));

const { Setting } = require('../../../models');
const { getSavedPlatformSmsConfig } = require('../../../services/platformSmsSettingsService');
const { checkPlatformSmsLimit, incrementPlatformSmsUsage } = require('../../../services/platformSmsUsageService');
const smsService = require('../../../services/smsService');
const axios = require('axios');

jest.mock('axios');

describe('smsService config resolution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getSavedPlatformSmsConfig.mockResolvedValue(null);
    checkPlatformSmsLimit.mockResolvedValue({ allowed: true, summary: {} });
    incrementPlatformSmsUsage.mockResolvedValue(1);
  });

  it('prefers tenant SMS when enabled with valid credentials', async () => {
    Setting.findOne.mockResolvedValue({
      value: {
        enabled: true,
        provider: 'termii',
        apiKey: 'tenant-key',
        senderId: 'SHOP01',
      },
    });

    const config = await smsService.getResolvedConfig('tenant-1');

    expect(config.source).toBe('tenant');
    expect(config.limited).toBe(false);
    expect(getSavedPlatformSmsConfig).not.toHaveBeenCalled();
  });

  it('falls back to platform SMS when tenant SMS is not configured', async () => {
    Setting.findOne.mockResolvedValue({ value: { enabled: false } });
    getSavedPlatformSmsConfig.mockResolvedValue({
      enabled: true,
      provider: 'arkesel',
      apiKey: 'platform-key',
      senderId: 'ABS',
      source: 'platform',
      limited: true,
      monthlyLimit: 100,
    });

    const config = await smsService.getResolvedConfig('tenant-1');

    expect(config.source).toBe('platform');
    expect(config.limited).toBe(true);
    expect(config.senderId).toBe('ABS');
  });

  it('returns PLATFORM_SMS_MONTHLY_LIMIT when platform quota is exceeded', async () => {
    Setting.findOne.mockResolvedValue({ value: { enabled: false } });
    getSavedPlatformSmsConfig.mockResolvedValue({
      enabled: true,
      provider: 'arkesel',
      apiKey: 'platform-key',
      senderId: 'ABS',
      source: 'platform',
      limited: true,
    });
    checkPlatformSmsLimit.mockResolvedValue({
      allowed: false,
      errorCode: 'PLATFORM_SMS_MONTHLY_LIMIT',
      error: 'limit reached',
      summary: { sentCount: 100, monthlyLimit: 100 },
    });

    const result = await smsService.sendMessage('tenant-1', '+233241234567', 'Hello');

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('PLATFORM_SMS_MONTHLY_LIMIT');
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('increments platform usage only after a successful Arkesel send', async () => {
    Setting.findOne.mockResolvedValue({ value: { enabled: false } });
    getSavedPlatformSmsConfig.mockResolvedValue({
      enabled: true,
      provider: 'arkesel',
      apiKey: 'platform-key',
      senderId: 'ABS',
      source: 'platform',
      limited: true,
    });
    axios.post.mockResolvedValue({ data: { data: [{ id: 'msg-1' }] } });

    const result = await smsService.sendMessage('tenant-1', '+233241234567', 'Hello');

    expect(result.success).toBe(true);
    expect(incrementPlatformSmsUsage).toHaveBeenCalledWith('tenant-1', 1);
  });
});
