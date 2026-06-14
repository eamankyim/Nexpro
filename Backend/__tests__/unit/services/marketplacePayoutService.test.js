jest.mock('../../../config/database', () => ({
  sequelize: {
    transaction: jest.fn(),
    where: jest.fn((left, right) => ({ left, right })),
    literal: jest.fn((sql) => sql),
  },
}));

jest.mock('../../../models', () => ({
  MarketplacePayout: {},
  Tenant: {},
}));

jest.mock('../../../services/paystackService', () => ({
  secretKey: 'sk_test_example',
  createTransferRecipient: jest.fn(),
  initiateTransfer: jest.fn(),
  verifyTransfer: jest.fn(),
  getMoMoBankCode: jest.fn(() => 'MTN'),
}));

jest.mock('../../../services/tradeAssuranceService', () => ({
  finalizeMarketplacePayoutTransfer: jest.fn(),
  revertMarketplacePayoutToAvailable: jest.fn(),
}));

const {
  buildTransferReference,
  isPaystackTransferCompleted,
} = require('../../../services/marketplacePayoutService');

describe('marketplacePayoutService', () => {
  it('builds a stable Paystack transfer reference from payout id', () => {
    const reference = buildTransferReference({ id: '11111111-2222-3333-4444-555555555555' });
    expect(reference.startsWith('mp_')).toBe(true);
    expect(reference.length).toBeLessThanOrEqual(50);
  });

  it('requires Paystack completion evidence before treating a transfer as completed', () => {
    expect(isPaystackTransferCompleted({ status: 'pending' })).toBe(false);
    expect(isPaystackTransferCompleted({ status: 'otp' })).toBe(false);
    expect(isPaystackTransferCompleted({ status: 'success', transferred_at: '2026-06-11T17:00:00Z' })).toBe(true);
    expect(isPaystackTransferCompleted({ status: 'success', transferred: true })).toBe(true);
  });
});
