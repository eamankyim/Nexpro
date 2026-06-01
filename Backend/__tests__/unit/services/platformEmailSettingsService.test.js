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

jest.mock('../../../services/emailService', () => ({
  getPlatformConfig: jest.fn(() => null),
  testConnection: jest.fn(),
}));

const { Setting } = require('../../../models');
const { encryptSecret, hasKey } = require('../../../utils/secretCrypto');
const emailService = require('../../../services/emailService');
const platformEmailSettingsService = require('../../../services/platformEmailSettingsService');

describe('platformEmailSettingsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    hasKey.mockReturnValue(true);
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

  it('keeps an existing legacy Gmail password when saving SMTP with a blank password', async () => {
    const save = jest.fn();
    Setting.findOne.mockResolvedValue({
      value: {
        provider: 'gmail',
        gmail: {
          user: 'platform@gmail.com',
          smtpHost: 'smtp.gmail.com',
          smtpPort: 587,
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
        provider: 'smtp',
        smtp: {
          smtpHost: 'smtp.gmail.com',
          smtpPort: 587,
          smtpUser: 'platform@gmail.com',
          password: '',
          fromName: 'ABS',
        },
      },
    });

    const setting = await Setting.findOne.mock.results[0].value;
    expect(setting.value.provider).toBe('smtp');
    expect(setting.value.smtp.password).toBe('enc:old-password');
    expect(setting.value.smtp.passwordLast4).toBe('word');
    expect(summary.smtp.passwordConfigured).toBe(true);
    expect(JSON.stringify(summary)).not.toContain('old-password');
  });

  it('returns a validation error when saving a new secret without an encryption key', async () => {
    hasKey.mockReturnValue(false);
    Setting.findOne.mockResolvedValue(null);

    await expect(platformEmailSettingsService.savePlatformEmailSettings({
      userId: 'admin-1',
      payload: {
        provider: 'sendgrid',
        sendgrid: {
          apiKey: 'SG.secret-value-1234',
          fromEmail: 'info@example.com',
        },
      },
    })).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('PLATFORM_EMAIL_CREDENTIALS_ENCRYPTION_KEY'),
    });

    expect(Setting.create).not.toHaveBeenCalled();
  });

  it('tests SMTP connection with form-entered credentials', async () => {
    Setting.findOne.mockResolvedValue({ value: { provider: 'smtp', smtp: {} } });
    emailService.testConnection.mockResolvedValue({
      success: true,
      message: 'Email connection verified successfully',
    });

    const result = await platformEmailSettingsService.testPlatformEmailConnection({
      userId: 'admin-1',
      requestId: 'req-smtp',
      payload: {
        provider: 'smtp',
        smtp: {
          smtpHost: 'smtp.gmail.com',
          smtpPort: 587,
          smtpUser: 'platform@gmail.com',
          password: 'app-password',
          fromEmail: 'platform@gmail.com',
        },
      },
    });

    expect(emailService.testConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'smtp',
        smtpHost: 'smtp.gmail.com',
        smtpPort: 587,
        smtpUser: 'platform@gmail.com',
        smtpPassword: 'app-password',
      }),
      expect.objectContaining({
        context: expect.objectContaining({
          source: 'platform_settings_email_test',
          mode: 'form_values',
        }),
      })
    );
    expect(result.provider).toBe('smtp');
  });

  it('allows non-secret platform email edits even when active credentials are incomplete', async () => {
    Setting.findOne.mockResolvedValue(null);

    const summary = await platformEmailSettingsService.savePlatformEmailSettings({
      userId: 'admin-1',
      payload: {
        provider: 'sendgrid',
        sendgrid: {
          fromEmail: 'info@example.com',
          fromName: 'ABS',
        },
      },
    });

    expect(Setting.create).toHaveBeenCalledWith(expect.objectContaining({
      value: expect.objectContaining({
        provider: 'sendgrid',
        sendgrid: expect.objectContaining({
          fromEmail: 'info@example.com',
          fromName: 'ABS',
        }),
      }),
    }));
    expect(summary.sendgrid.apiKeyConfigured).toBe(false);
  });
});
