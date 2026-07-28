const {
  COMMERCE_CHANNELS,
  PAYSTACK_ORDER_TYPES,
  normalizeCommerceChannel,
  resolveCommerceChannelFromRequest,
  usesTradeAssurance,
  paystackOrderTypeForChannel,
  getSaleCommerceChannel,
  getStorefrontPublicBaseUrl,
} = require('../../../utils/storefrontCommerceChannel');

describe('storefrontCommerceChannel', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('normalizes channel aliases', () => {
    expect(normalizeCommerceChannel('sabito')).toBe(COMMERCE_CHANNELS.SABITO_MARKETPLACE);
    expect(normalizeCommerceChannel('marketplace')).toBe(COMMERCE_CHANNELS.SABITO_MARKETPLACE);
    expect(normalizeCommerceChannel('online_store')).toBe(COMMERCE_CHANNELS.ONLINE_STORE);
    expect(normalizeCommerceChannel('')).toBe(COMMERCE_CHANNELS.ONLINE_STORE);
  });

  it('resolves channel from body before headers/host', () => {
    const req = {
      headers: {
        'x-storefront-channel': 'online_store',
        host: 'sabitostore.com',
      },
    };
    expect(resolveCommerceChannelFromRequest(req, { commerceChannel: 'sabito_marketplace' }))
      .toBe(COMMERCE_CHANNELS.SABITO_MARKETPLACE);
  });

  it('uses trade assurance only for Sabito marketplace', () => {
    expect(usesTradeAssurance(COMMERCE_CHANNELS.SABITO_MARKETPLACE)).toBe(true);
    expect(usesTradeAssurance(COMMERCE_CHANNELS.ONLINE_STORE)).toBe(false);
    expect(paystackOrderTypeForChannel(COMMERCE_CHANNELS.SABITO_MARKETPLACE))
      .toBe(PAYSTACK_ORDER_TYPES.SABITO_MARKETPLACE);
    expect(paystackOrderTypeForChannel(COMMERCE_CHANNELS.ONLINE_STORE))
      .toBe(PAYSTACK_ORDER_TYPES.ONLINE_STORE);
  });

  it('infers legacy held payments as Sabito channel', () => {
    expect(getSaleCommerceChannel({
      tradeAssurance: { marketplacePaymentId: 'pay-1', paymentStatus: 'paid_held' },
    })).toBe(COMMERCE_CHANNELS.SABITO_MARKETPLACE);
    expect(getSaleCommerceChannel({})).toBe(COMMERCE_CHANNELS.ONLINE_STORE);
  });

  it('picks Online Store URL for direct-pay callbacks', () => {
    process.env.STOREFRONT_URL = 'https://sabito.example';
    process.env.ONLINE_STORE_URL = 'https://store.example';
    expect(getStorefrontPublicBaseUrl(COMMERCE_CHANNELS.ONLINE_STORE)).toBe('https://store.example');
    expect(getStorefrontPublicBaseUrl(COMMERCE_CHANNELS.SABITO_MARKETPLACE)).toBe('https://sabito.example');
  });
});
