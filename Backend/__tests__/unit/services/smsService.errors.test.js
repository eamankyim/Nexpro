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

const { formatSmsProviderError } = require('../../../services/smsService');

describe('smsService.formatSmsProviderError', () => {
  it('maps axios timeouts to a credential-focused message', () => {
    const error = new Error('timeout of 10000ms exceeded');
    error.code = 'ECONNABORTED';

    expect(formatSmsProviderError(error)).toBe(
      'SMS provider timed out - check credentials and network connectivity'
    );
  });

  it('prefers provider response messages when available', () => {
    const error = new Error('Request failed');
    error.response = { data: { message: 'Invalid API key' } };

    expect(formatSmsProviderError(error)).toBe('Invalid API key');
  });
});
