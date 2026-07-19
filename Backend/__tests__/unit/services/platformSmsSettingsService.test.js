jest.mock('../../../models', () => ({
  Setting: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
}));

jest.mock('../../../utils/secretCrypto', () => ({
  decryptSecret: jest.fn((value) => value.replace('enc:', '')),
  encryptSecret: jest.fn((value) => `enc:${value}`),
  hasKey: jest.fn(() => true),
}));

jest.mock('../../../services/smsService', () => ({
  testConnection: jest.fn(),
}));

const { Setting } = require('../../../models');
const { encryptSecret, hasKey } = require('../../../utils/secretCrypto');
const smsService = require('../../../services/smsService');
const platformSmsSettingsService = require('../../../services/platformSmsSettingsService');

describe('platformSmsSettingsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    hasKey.mockReturnValue(true);
  });

  it('saves Arkesel credentials encrypted and returns only masked status', async () => {
    Setting.findOne.mockResolvedValue(null);

    const summary = await platformSmsSettingsService.savePlatformSmsSettings({
      userId: 'admin-1',
      payload: {
        enabled: true,
        activeProvider: 'arkesel',
        arkesel: {
          apiKey: 'arkesel-secret-key-1234',
          senderId: 'ABS',
        },
        monthlyLimit: 150,
      },
    });

    expect(encryptSecret).toHaveBeenCalledWith(
      'arkesel-secret-key-1234',
      platformSmsSettingsService.PLATFORM_SMS_CREDENTIALS_ENCRYPTION_KEY
    );
    expect(Setting.create).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: null,
      key: 'platform:sms',
      value: expect.objectContaining({
        enabled: true,
        activeProvider: 'arkesel',
        arkesel: expect.objectContaining({
          apiKey: 'enc:arkesel-secret-key-1234',
          apiKeyLast4: '1234',
          senderId: 'ABS',
        }),
        monthlyLimit: 150,
      }),
    }));
    expect(summary.activeProvider).toBe('arkesel');
    expect(summary.arkesel.apiKeyConfigured).toBe(true);
    expect(summary.arkesel.apiKeyMasked).toBe('•••• 1234');
    expect(JSON.stringify(summary)).not.toContain('arkesel-secret-key-1234');
  });

  it('can switch active provider to Mnotify while keeping Arkesel credentials', async () => {
    Setting.findOne.mockResolvedValue({
      value: {
        enabled: true,
        activeProvider: 'arkesel',
        arkesel: {
          apiKey: 'enc:arkesel-secret-key-1234',
          apiKeyLast4: '1234',
          senderId: 'ABS',
        },
        mnotify: { senderId: 'ABS' },
      },
      save: jest.fn(),
    });

    const setting = await Setting.findOne();
    Setting.findOne.mockResolvedValue(setting);

    const summary = await platformSmsSettingsService.savePlatformSmsSettings({
      userId: 'admin-1',
      payload: {
        enabled: true,
        activeProvider: 'mnotify',
        mnotify: {
          apiKey: 'mnotify-secret-key-9876',
          senderId: 'ABS',
        },
      },
    });

    expect(setting.save).toHaveBeenCalled();
    expect(setting.value.activeProvider).toBe('mnotify');
    expect(setting.value.arkesel.apiKey).toBe('enc:arkesel-secret-key-1234');
    expect(setting.value.mnotify.apiKey).toBe('enc:mnotify-secret-key-9876');
    expect(summary.activeProvider).toBe('mnotify');
    expect(summary.mnotify.apiKeyMasked).toBe('•••• 9876');
    expect(summary.arkesel.apiKeyConfigured).toBe(true);
  });

  it('returns a validation error when saving a new secret without an encryption key', async () => {
    hasKey.mockReturnValue(false);
    Setting.findOne.mockResolvedValue(null);

    await expect(platformSmsSettingsService.savePlatformSmsSettings({
      userId: 'admin-1',
      payload: {
        enabled: true,
        arkesel: {
          apiKey: 'arkesel-secret-key-1234',
          senderId: 'ABS',
        },
      },
    })).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('PLATFORM_SMS_CREDENTIALS_ENCRYPTION_KEY'),
    });

    expect(Setting.create).not.toHaveBeenCalled();
  });

  it('tests Mnotify connection with form-entered credentials', async () => {
    Setting.findOne.mockResolvedValue({
      value: { enabled: true, activeProvider: 'mnotify', mnotify: {} },
    });
    smsService.testConnection.mockResolvedValue({
      success: true,
      message: 'Mnotify connection verified',
      data: { balance: 10 },
    });

    const result = await platformSmsSettingsService.testPlatformSmsConnection({
      userId: 'admin-1',
      requestId: 'req-mnotify',
      payload: {
        activeProvider: 'mnotify',
        mnotify: {
          apiKey: 'mnotify-test-key',
          senderId: 'ABS',
        },
      },
    });

    expect(smsService.testConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'mnotify',
        apiKey: 'mnotify-test-key',
        senderId: 'ABS',
      }),
      expect.objectContaining({
        context: expect.objectContaining({
          source: 'platform_settings_sms_test',
          mode: 'form_values',
        }),
      })
    );
    expect(result.provider).toBe('mnotify');
  });

  it('builds runtime config from active provider only', async () => {
    Setting.findOne.mockResolvedValue({
      value: {
        enabled: true,
        activeProvider: 'mnotify',
        arkesel: {
          apiKey: 'enc:arkesel-secret-key-1234',
          apiKeyLast4: '1234',
          senderId: 'ABS',
        },
        mnotify: {
          apiKey: 'enc:mnotify-secret-key-9876',
          apiKeyLast4: '9876',
          senderId: 'ABSMSG',
        },
      },
    });

    const config = await platformSmsSettingsService.getSavedPlatformSmsConfig();
    expect(config).toMatchObject({
      provider: 'mnotify',
      apiKey: 'mnotify-secret-key-9876',
      senderId: 'ABSMSG',
      source: 'platform',
      limited: true,
    });
  });
});
