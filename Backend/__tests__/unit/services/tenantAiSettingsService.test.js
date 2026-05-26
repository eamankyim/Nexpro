jest.mock('../../../models', () => ({
  Setting: {
    findOne: jest.fn(),
    findOrCreate: jest.fn()
  }
}));

jest.mock('../../../utils/secretCrypto', () => ({
  decryptSecret: jest.fn((value) => value.replace('enc:', '')),
  encryptSecret: jest.fn((value) => `enc:${value}`),
  hasKey: jest.fn(() => true)
}));

const { Setting } = require('../../../models');
const { encryptSecret } = require('../../../utils/secretCrypto');
const {
  getTenantAiSettingsSummary,
  getTenantAnthropicApiKey,
  saveTenantAiApiKey,
  clearTenantAiApiKey
} = require('../../../services/tenantAiSettingsService');

describe('tenantAiSettingsService', () => {
  const originalAnthropicKey = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'system-key-123456789012345678901234567890';
  });

  afterAll(() => {
    process.env.ANTHROPIC_API_KEY = originalAnthropicKey;
  });

  it('returns masked tenant summary without exposing the stored key', async () => {
    Setting.findOne.mockResolvedValue({
      value: {
        apiKey: 'enc:tenant-key-123456789012345678901234567890',
        apiKeyLast4: '7890',
        updatedAt: '2026-05-25T00:00:00.000Z'
      }
    });

    const summary = await getTenantAiSettingsSummary('tenant-1');

    expect(summary).toEqual({
      provider: 'anthropic',
      source: 'tenant',
      apiKeyConfigured: true,
      apiKeyMasked: '•••• 7890',
      systemConfigured: true,
      encryptionConfigured: true,
      updatedAt: '2026-05-25T00:00:00.000Z'
    });
  });

  it('prefers tenant key over system key when resolving Anthropic credentials', async () => {
    Setting.findOne.mockResolvedValue({
      value: {
        apiKey: 'enc:tenant-key-123456789012345678901234567890'
      }
    });

    const key = await getTenantAnthropicApiKey('tenant-1');
    expect(key).toBe('tenant-key-123456789012345678901234567890');
  });

  it('encrypts and stores a tenant key without returning the raw value', async () => {
    Setting.findOrCreate.mockResolvedValue([
      {
        value: {},
        save: jest.fn()
      },
      true
    ]);

    const summary = await saveTenantAiApiKey({
      tenantId: 'tenant-1',
      apiKey: 'tenant-key-123456789012345678901234567890',
      userId: 'user-1'
    });

    expect(encryptSecret).toHaveBeenCalledWith(
      'tenant-key-123456789012345678901234567890',
      'AI_CREDENTIALS_ENCRYPTION_KEY'
    );
    expect(summary.apiKeyConfigured).toBe(true);
    expect(summary.apiKeyMasked).toBe('•••• 7890');
    expect(summary.source).toBe('tenant');
  });

  it('clears tenant override and falls back to system source metadata', async () => {
    Setting.findOne.mockResolvedValue({ destroy: jest.fn().mockResolvedValue(undefined) });

    const summary = await clearTenantAiApiKey('tenant-1');

    expect(summary.apiKeyConfigured).toBe(false);
    expect(summary.source).toBe('system');
    expect(summary.apiKeyMasked).toBe('');
  });
});
