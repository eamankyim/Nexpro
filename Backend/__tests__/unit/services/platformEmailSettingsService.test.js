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

const { Setting } = require('../../../models');
const { encryptSecret } = require('../../../utils/secretCrypto');
const platformEmailSettingsService = require('../../../services/platformEmailSettingsService');

describe('platformEmailSettingsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('saves SendGrid credentials encrypted and returns only masked status', async () => {
    Setting.findOne.mockResolvedValue(null);

    const summary = await platformEmailSettingsService.savePlatformEmailSettings({
      userId: 'admin-1',
      payload: {
        provider: 'sendgrid',
        sendgrid: {
          apiKey: 'SG.secret-value-1234',
          fromEmail: 'info@example.com',
          fromName: 'ABS',
        },
      },
    });

    expect(encryptSecret).toHaveBeenCalledWith(
      'SG.secret-value-1234',
      platformEmailSettingsService.PLATFORM_EMAIL_CREDENTIALS_ENCRYPTION_KEY
    );
    expect(Setting.create).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: null,
      key: 'platform:email',
      value: expect.objectContaining({
        provider: 'sendgrid',
        sendgrid: expect.objectContaining({
          apiKey: 'enc:SG.secret-value-1234',
          apiKeyLast4: '1234',
          fromEmail: 'info@example.com',
        }),
      }),
    }));
    expect(summary.sendgrid.apiKeyConfigured).toBe(true);
    expect(summary.sendgrid.apiKeyMasked).toBe('•••• 1234');
    expect(JSON.stringify(summary)).not.toContain('SG.secret-value-1234');
  });

  it('keeps an existing Gmail password when the submitted password is blank', async () => {
    const save = jest.fn();
    Setting.findOne.mockResolvedValue({
      value: {
        provider: 'gmail',
        gmail: {
          user: 'platform@gmail.com',
          password: 'enc:old-password',
          passwordLast4: 'word',
          fromEmail: 'platform@gmail.com',
        },
      },
      save,
    });

    const summary = await platformEmailSettingsService.savePlatformEmailSettings({
      userId: 'admin-1',
      payload: {
        provider: 'gmail',
        gmail: {
          user: 'platform@gmail.com',
          password: '',
          fromName: 'ABS',
        },
      },
    });

    const setting = await Setting.findOne.mock.results[0].value;
    expect(setting.value.gmail.password).toBe('enc:old-password');
    expect(setting.value.gmail.passwordLast4).toBe('word');
    expect(summary.gmail.passwordConfigured).toBe(true);
    expect(JSON.stringify(summary)).not.toContain('old-password');
  });
});
