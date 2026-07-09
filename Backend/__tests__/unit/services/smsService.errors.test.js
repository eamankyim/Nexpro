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
