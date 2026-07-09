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
        arkesel: expect.objectContaining({
          apiKey: 'enc:arkesel-secret-key-1234',
          apiKeyLast4: '1234',
          senderId: 'ABS',
        }),
        monthlyLimit: 150,
      }),
    }));
    expect(summary.arkesel.apiKeyConfigured).toBe(true);
    expect(summary.arkesel.apiKeyMasked).toBe('•••• 1234');
    expect(JSON.stringify(summary)).not.toContain('arkesel-secret-key-1234');
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

  it('tests Arkesel connection with form-entered credentials', async () => {
    Setting.findOne.mockResolvedValue({ value: { enabled: true, arkesel: {} } });
    smsService.testConnection.mockResolvedValue({
      success: true,
      message: 'Arkesel connection verified',
      data: { balance: 10 },
    });

    const result = await platformSmsSettingsService.testPlatformSmsConnection({
      userId: 'admin-1',
      requestId: 'req-arkesel',
      payload: {
        arkesel: {
          apiKey: 'arkesel-test-key',
          senderId: 'ABS',
        },
      },
    });

    expect(smsService.testConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'arkesel',
        apiKey: 'arkesel-test-key',
        senderId: 'ABS',
      }),
      expect.objectContaining({
        context: expect.objectContaining({
          source: 'platform_settings_sms_test',
          mode: 'form_values',
        }),
      })
    );
    expect(result.provider).toBe('arkesel');
  });
});
