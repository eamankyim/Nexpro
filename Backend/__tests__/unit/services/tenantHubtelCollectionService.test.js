jest.mock('../../../models/Tenant', () => ({
  findByPk: jest.fn(),
}));

jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
}));

const Tenant = require('../../../models/Tenant');
const axios = require('axios');
const {
  encryptJson,
  isEncryptionConfigured,
} = require('../../../utils/momoCredentialsCrypto');
const {
  getHubtelCollectionPublicSummary,
  getResolvedHubtelConfigForTenant,
  saveTenantHubtelCollectionCredentials,
  clearTenantHubtelCollectionCredentials,
  testHubtelCredentials,
} = require('../../../services/tenantHubtelCollectionService');

describe('tenantHubtelCollectionService', () => {
  const encryptionKey = 'a'.repeat(64);

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.MOMO_CREDENTIALS_ENCRYPTION_KEY = encryptionKey;
  });

  afterEach(() => {
    delete process.env.MOMO_CREDENTIALS_ENCRYPTION_KEY;
  });

  it('reports encryptionConfigured based on env key', () => {
    expect(isEncryptionConfigured()).toBe(true);
    delete process.env.MOMO_CREDENTIALS_ENCRYPTION_KEY;
    expect(isEncryptionConfigured()).toBe(false);
  });

  it('returns masked public summary when credentials are stored', () => {
    const secretsEnc = encryptJson({
      clientId: 'hubtel-client-abc123',
      clientSecret: 'super-secret-value',
    });
    const tenant = {
      metadata: {
        hubtelCollectionCredentials: {
          secretsEnc,
          merchantAccountNumber: 'HM123',
          posSalesId: 'POS-9',
        },
      },
    };

    const summary = getHubtelCollectionPublicSummary(tenant);
    expect(summary.configured).toBe(true);
    expect(summary.clientIdMasked).toBe('****c123');
    expect(summary.merchantAccountNumber).toBe('HM123');
    expect(summary.posSalesId).toBe('POS-9');
    expect(summary.encryptionConfigured).toBe(true);
  });

  it('resolves decrypted Hubtel config for charging (Receive Money)', () => {
    const secretsEnc = encryptJson({
      clientId: 'cid',
      clientSecret: 'csecret',
    });
    const tenant = {
      metadata: {
        hubtelCollectionCredentials: {
          secretsEnc,
          merchantAccountNumber: 'HM1',
          posSalesId: 'POS1',
        },
      },
    };

    expect(getResolvedHubtelConfigForTenant(tenant)).toEqual({
      clientId: 'cid',
      clientSecret: 'csecret',
      merchantAccountNumber: 'HM1',
      posSalesId: 'POS1',
    });
  });

  it('saves encrypted credentials on tenant metadata', async () => {
    const tenant = {
      id: 't1',
      metadata: {},
      save: jest.fn().mockResolvedValue(undefined),
    };
    Tenant.findByPk.mockResolvedValue(tenant);

    const summary = await saveTenantHubtelCollectionCredentials('t1', {
      clientId: ' my-client ',
      clientSecret: ' my-secret ',
      merchantAccountNumber: ' HM99 ',
      posSalesId: ' POS88 ',
    });

    expect(tenant.save).toHaveBeenCalledWith({ fields: ['metadata'] });
    expect(tenant.metadata.hubtelCollectionCredentials.secretsEnc).toBeTruthy();
    expect(tenant.metadata.hubtelCollectionCredentials.merchantAccountNumber).toBe('HM99');
    expect(tenant.metadata.hubtelCollectionCredentials.posSalesId).toBe('POS88');
    expect(summary.configured).toBe(true);
    expect(summary.clientIdMasked).toBe('****ient');
  });

  it('clears Hubtel credentials from metadata', async () => {
    const tenant = {
      id: 't1',
      metadata: {
        hubtelCollectionCredentials: { secretsEnc: 'x' },
        other: true,
      },
      save: jest.fn().mockResolvedValue(undefined),
    };
    Tenant.findByPk.mockResolvedValue(tenant);

    await clearTenantHubtelCollectionCredentials('t1');

    expect(tenant.metadata.hubtelCollectionCredentials).toBeUndefined();
    expect(tenant.metadata.other).toBe(true);
    expect(tenant.save).toHaveBeenCalledWith({ fields: ['metadata'] });
  });

  it('treats non-401 Hubtel status responses as successful auth tests', async () => {
    axios.get.mockResolvedValue({ status: 404, data: { message: 'Not found' } });

    await expect(
      testHubtelCredentials({
        clientId: 'cid',
        clientSecret: 'csecret',
        posSalesId: 'POS1',
      })
    ).resolves.toEqual({ ok: true });

    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining('/POS1/status'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: expect.stringMatching(/^Basic /),
        }),
      })
    );
  });

  it('rejects Hubtel auth failures on 401', async () => {
    axios.get.mockResolvedValue({ status: 401, data: {} });

    await expect(
      testHubtelCredentials({ clientId: 'bad', clientSecret: 'bad' })
    ).rejects.toThrow(/authentication failed/i);
  });
});
