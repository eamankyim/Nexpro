jest.mock('../../../models/Tenant', () => ({
  findByPk: jest.fn(),
}));

const Tenant = require('../../../models/Tenant');
const { encryptJson } = require('../../../utils/momoCredentialsCrypto');
const {
  getMtnCollectionPublicSummary,
  saveTenantMtnCollectionCredentials,
  getResolvedMtnConfigForTenant,
  getTenantMtnChargeConfig,
  getMerchantIdOnlyBlockReason,
} = require('../../../services/tenantMomoCollectionService');

describe('tenantMomoCollectionService merchant ID', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.MOMO_CREDENTIALS_ENCRYPTION_KEY = 'b'.repeat(64);
  });

  afterEach(() => {
    delete process.env.MOMO_CREDENTIALS_ENCRYPTION_KEY;
    delete process.env.MTN_MOMO_SUBSCRIPTION_KEY;
    delete process.env.MTN_MOMO_API_USER;
    delete process.env.MTN_MOMO_API_KEY;
  });

  it('exposes merchantId in public summary without requiring API secrets', () => {
    const summary = getMtnCollectionPublicSummary({
      metadata: {
        mtnCollectionCredentials: {
          merchantId: 'MTN-MERCHANT-99',
        },
      },
    });

    expect(summary.merchantId).toBe('MTN-MERCHANT-99');
    expect(summary.configured).toBe(true);
    expect(summary.hasApiCredentials).toBe(false);
    expect(summary.activeSource).toBe('merchant_id');
  });

  it('saves Merchant ID alone without encrypting secrets', async () => {
    const tenant = {
      id: 't1',
      metadata: {},
      save: jest.fn().mockResolvedValue(undefined),
    };
    Tenant.findByPk.mockResolvedValue(tenant);

    const summary = await saveTenantMtnCollectionCredentials('t1', {
      merchantId: ' MERCH-1 ',
    });

    expect(tenant.metadata.mtnCollectionCredentials.merchantId).toBe('MERCH-1');
    expect(tenant.metadata.mtnCollectionCredentials.secretsEnc).toBeUndefined();
    expect(summary.merchantId).toBe('MERCH-1');
    expect(summary.hasApiCredentials).toBe(false);
  });

  it('preserves existing API secrets when updating only Merchant ID', async () => {
    const secretsEnc = encryptJson({
      subscriptionKey: 'sk',
      apiUser: 'user',
      apiKey: 'key',
    });
    const tenant = {
      id: 't1',
      metadata: {
        mtnCollectionCredentials: {
          secretsEnc,
          merchantId: 'OLD',
          environment: 'sandbox',
        },
      },
      save: jest.fn().mockResolvedValue(undefined),
    };
    Tenant.findByPk.mockResolvedValue(tenant);

    const summary = await saveTenantMtnCollectionCredentials('t1', {
      merchantId: 'NEW-ID',
    });

    expect(tenant.metadata.mtnCollectionCredentials.merchantId).toBe('NEW-ID');
    expect(tenant.metadata.mtnCollectionCredentials.secretsEnc).toBe(secretsEnc);
    expect(summary.hasApiCredentials).toBe(true);
  });

  it('does not resolve platform MTN when Merchant ID is saved without API keys', () => {
    process.env.MTN_MOMO_SUBSCRIPTION_KEY = 'plat-sk';
    process.env.MTN_MOMO_API_USER = 'plat-user';
    process.env.MTN_MOMO_API_KEY = 'plat-key';

    const tenant = {
      metadata: {
        mtnCollectionCredentials: { merchantId: 'MERCH-1' }
      }
    };

    expect(getTenantMtnChargeConfig(tenant)).toBeNull();
    expect(getResolvedMtnConfigForTenant(tenant)).toBeNull();
    expect(getMerchantIdOnlyBlockReason(tenant)).toMatch(/advanced credentials|Collection API/i);
  });

  it('resolves tenant MTN charge config with merchantId metadata', () => {
    const secretsEnc = encryptJson({
      subscriptionKey: 'sk',
      apiUser: 'user',
      apiKey: 'key'
    });
    const tenant = {
      metadata: {
        mtnCollectionCredentials: {
          secretsEnc,
          merchantId: 'MERCH-22',
          environment: 'production'
        }
      }
    };

    const cfg = getTenantMtnChargeConfig(tenant);
    expect(cfg.source).toBe('tenant');
    expect(cfg.merchantId).toBe('MERCH-22');
    expect(cfg.environment).toBe('production');
  });
});
