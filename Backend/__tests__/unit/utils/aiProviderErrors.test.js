jest.mock('../../../services/tenantAiSettingsService', () => ({
  getTenantAnthropicApiKey: jest.fn(),
}));

const { getTenantAnthropicApiKey } = require('../../../services/tenantAiSettingsService');
const {
  assertAiProviderConfigured,
  AI_PROVIDER_USER_MESSAGES,
  buildBillingCircuitError,
  classifyAiProviderError,
  clearBillingCircuit,
  isBillingCreditError,
  normalizeAiProviderError,
  openBillingCircuit,
} = require('../../../utils/aiProviderErrors');

describe('aiProviderErrors', () => {
  const originalAnthropicKey = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    clearBillingCircuit('tenant-1');
    clearBillingCircuit(null);
    process.env.ANTHROPIC_API_KEY = 'system-key-123456789012345678901234567890';
  });

  afterAll(() => {
    process.env.ANTHROPIC_API_KEY = originalAnthropicKey;
  });

  it('classifies Anthropic low-credit errors as billing required', () => {
    const classified = classifyAiProviderError({
      status: 400,
      message: '400 Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.',
      error: {
        type: 'invalid_request_error',
        message: 'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.',
      },
    });

    expect(classified).toMatchObject({
      statusCode: 402,
      errorCode: 'AI_PROVIDER_BILLING_REQUIRED',
      message: AI_PROVIDER_USER_MESSAGES.AI_PROVIDER_BILLING_REQUIRED,
    });
    expect(classified.message).not.toMatch(/anthropic api key/i);
    expect(classified.message).not.toMatch(/plans & billing/i);
  });

  it('detects billing credit errors from nested provider payloads', () => {
    expect(isBillingCreditError({
      error: {
        type: 'insufficient_balance_error',
        message: 'Usage is blocked due to insufficient credits.',
      },
    })).toBe(true);
  });

  it('normalizes provider billing errors without leaking raw provider details', () => {
    expect(() => normalizeAiProviderError({
      status: 400,
      headers: { 'x-api-key': 'secret-should-not-appear' },
      message: 'Your credit balance is too low to access the Anthropic API.',
    })).toThrow(expect.objectContaining({
      statusCode: 402,
      errorCode: 'AI_PROVIDER_BILLING_REQUIRED',
      aiProviderError: true,
    }));
  });

  it('fails fast when no tenant or system Anthropic key is configured', async () => {
    process.env.ANTHROPIC_API_KEY = '';
    getTenantAnthropicApiKey.mockResolvedValue(null);

    await expect(assertAiProviderConfigured('tenant-1')).rejects.toMatchObject({
      statusCode: 503,
      errorCode: 'OPENAI_NOT_CONFIGURED',
      aiProviderError: true,
    });
  });

  it('opens a short billing circuit breaker after a billing failure', () => {
    const billingError = {
      status: 400,
      message: 'Your credit balance is too low to access the Anthropic API.',
    };

    openBillingCircuit('tenant-1', billingError);
    const circuitError = buildBillingCircuitError('tenant-1');

    expect(circuitError).toMatchObject({
      statusCode: 402,
      errorCode: 'AI_PROVIDER_BILLING_REQUIRED',
      circuitBreaker: true,
    });
  });
});
