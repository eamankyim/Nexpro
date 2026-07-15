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

const { formatSmsProviderError, classifySmsProviderError } = require('../../../services/smsService');

describe('smsService.formatSmsProviderError', () => {
  it('maps axios timeouts to a delivery-aware message', () => {
    const error = new Error('timeout of 45000ms exceeded');
    error.code = 'ECONNABORTED';

    expect(formatSmsProviderError(error)).toBe(
      'SMS provider did not respond in time - the message may still be delivered'
    );
  });

  it('prefers provider response messages when available', () => {
    const error = new Error('Request failed');
    error.response = { data: { message: 'Invalid API key' } };

    expect(formatSmsProviderError(error)).toBe('Invalid API key');
  });
});

describe('smsService.classifySmsProviderError', () => {
  it('maps Arkesel insufficient balance / invalid coverage to an actionable provider message', () => {
    const error = new Error('Request failed');
    error.response = {
      status: 400,
      data: { message: 'Insufficient balance or invalid coverage!' },
    };

    expect(classifySmsProviderError(error)).toEqual({
      error:
        'SMS provider (Arkesel) balance empty or destination not covered — top up Arkesel (this is not the ABS platform SMS quota)',
      errorCode: 'SMS_PROVIDER_BALANCE_OR_COVERAGE',
    });
  });

  it('maps HTTP 402 / code 105 the same way', () => {
    expect(classifySmsProviderError('fail', { httpStatus: 402 })).toMatchObject({
      errorCode: 'SMS_PROVIDER_BALANCE_OR_COVERAGE',
    });
    expect(classifySmsProviderError('fail', { providerCode: '105' })).toMatchObject({
      errorCode: 'SMS_PROVIDER_BALANCE_OR_COVERAGE',
    });
  });

  it('does not rewrite clear platform monthly-limit wording', () => {
    const message =
      'ABS platform SMS quota exhausted (100/100 this month). Connect your own SMS provider or wait until the monthly reset.';
    expect(classifySmsProviderError(message)).toEqual({ error: message });
  });

  it('maps coverage-not-active separately from balance', () => {
    expect(classifySmsProviderError('Phone coverage not active', { providerCode: '104' })).toEqual({
      error: 'SMS provider cannot reach this number — network coverage is not active for the destination',
      errorCode: 'SMS_PROVIDER_COVERAGE',
    });
  });
});
