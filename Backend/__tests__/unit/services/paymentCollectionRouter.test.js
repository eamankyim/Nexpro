jest.mock('../../../services/paystackService', () => ({
  secretKey: 'sk_test_mock'
}));

jest.mock('../../../utils/momoCredentialsCrypto', () => {
  const actual = jest.requireActual('../../../utils/momoCredentialsCrypto');
  return actual;
});

const { encryptJson } = require('../../../utils/momoCredentialsCrypto');
const {
  resolveMoMoCollector,
  buildPublicPaymentOptions,
  canDirectMoMoCharge
} = require('../../../services/paymentCollectionRouter');

describe('paymentCollectionRouter', () => {
  const encryptionKey = 'c'.repeat(64);

  beforeEach(() => {
    process.env.MOMO_CREDENTIALS_ENCRYPTION_KEY = encryptionKey;
    delete process.env.MTN_MOMO_SUBSCRIPTION_KEY;
    delete process.env.MTN_MOMO_API_USER;
    delete process.env.MTN_MOMO_API_KEY;
  });

  afterEach(() => {
    delete process.env.MOMO_CREDENTIALS_ENCRYPTION_KEY;
    delete process.env.MTN_MOMO_SUBSCRIPTION_KEY;
    delete process.env.MTN_MOMO_API_USER;
    delete process.env.MTN_MOMO_API_KEY;
  });

  function hubtelTenant() {
    return {
      metadata: {
        hubtelCollectionCredentials: {
          secretsEnc: encryptJson({ clientId: 'cid', clientSecret: 'csecret' }),
          posSalesId: 'POS-1'
        }
      }
    };
  }

  function mtnTenantWithKeys() {
    return {
      metadata: {
        mtnCollectionCredentials: {
          merchantId: 'MERCH-1',
          secretsEnc: encryptJson({
            subscriptionKey: 'sk',
            apiUser: 'user',
            apiKey: 'key'
          }),
          environment: 'sandbox'
        }
      }
    };
  }

  function mtnMerchantIdOnlyTenant() {
    return {
      metadata: {
        mtnCollectionCredentials: {
          merchantId: 'MERCH-ONLY'
        }
      }
    };
  }

  it('prefers Hubtel over MTN and Paystack', () => {
    const tenant = {
      metadata: {
        ...hubtelTenant().metadata,
        ...mtnTenantWithKeys().metadata
      }
    };
    // merge properly
    tenant.metadata = {
      hubtelCollectionCredentials: hubtelTenant().metadata.hubtelCollectionCredentials,
      mtnCollectionCredentials: mtnTenantWithKeys().metadata.mtnCollectionCredentials
    };

    const resolved = resolveMoMoCollector(tenant);
    expect(resolved.rail).toBe('hubtel');
    expect(resolved.hubtelConfig.clientId).toBe('cid');
  });

  it('uses tenant MTN when Hubtel missing', () => {
    const resolved = resolveMoMoCollector(mtnTenantWithKeys());
    expect(resolved.rail).toBe('mtn');
    expect(resolved.mtnConfig.source).toBe('tenant');
    expect(resolved.mtnConfig.merchantId).toBe('MERCH-1');
  });

  it('skips MTN Merchant ID-only and falls through to Paystack', () => {
    process.env.MTN_MOMO_SUBSCRIPTION_KEY = 'plat-sk';
    process.env.MTN_MOMO_API_USER = 'plat-user';
    process.env.MTN_MOMO_API_KEY = 'plat-key';

    const resolved = resolveMoMoCollector(mtnMerchantIdOnlyTenant());
    expect(resolved.rail).toBe('paystack');
    expect(resolved.skipped.some((s) => s.rail === 'mtn' && /API credentials/i.test(s.reason))).toBe(
      true
    );
  });

  it('uses platform MTN only when tenant has no Merchant ID', () => {
    process.env.MTN_MOMO_SUBSCRIPTION_KEY = 'plat-sk';
    process.env.MTN_MOMO_API_USER = 'plat-user';
    process.env.MTN_MOMO_API_KEY = 'plat-key';

    const resolved = resolveMoMoCollector({ metadata: {} });
    expect(resolved.rail).toBe('mtn');
    expect(resolved.mtnConfig.source).toBe('platform');
  });

  it('returns none when no collectors configured and Paystack disabled', () => {
    const paystackService = require('../../../services/paystackService');
    const prev = paystackService.secretKey;
    paystackService.secretKey = '';

    const resolved = resolveMoMoCollector({ metadata: {} }, { allowPaystack: true });
    expect(resolved.rail).toBe('none');
    expect(resolved.reason).toMatch(/payment collection/i);

    paystackService.secretKey = prev;
  });

  it('buildPublicPaymentOptions exposes directHubtel', () => {
    const options = buildPublicPaymentOptions(hubtelTenant(), { airtelDirectOk: false });
    expect(options.directHubtel).toBe(true);
    expect(options.directMoMo).toBe(true);
    expect(options.paystack).toBe(true);
  });

  it('canDirectMoMoCharge is true for Hubtel', () => {
    expect(canDirectMoMoCharge(hubtelTenant())).toBe(true);
  });

  it('canDirectMoMoCharge is false for Merchant ID only', () => {
    expect(canDirectMoMoCharge(mtnMerchantIdOnlyTenant())).toBe(false);
  });
});
