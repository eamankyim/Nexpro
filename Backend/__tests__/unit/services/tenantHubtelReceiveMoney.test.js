jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn()
}));

const axios = require('axios');
const {
  initiateReceiveMoney,
  checkReceiveMoneyStatus,
  parseHubtelCallback,
  mapProviderToHubtelChannel,
  normalizeHubtelPaymentStatus
} = require('../../../services/tenantHubtelCollectionService');

describe('Hubtel Receive Money', () => {
  const config = {
    clientId: 'cid',
    clientSecret: 'csecret',
    posSalesId: 'POS-99'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.HUBTEL_CALLBACK_URL = 'https://api.example.com/api/webhooks/hubtel';
  });

  afterEach(() => {
    delete process.env.HUBTEL_CALLBACK_URL;
  });

  it('maps Ghana providers to Hubtel channels', () => {
    expect(mapProviderToHubtelChannel('MTN')).toBe('mtn-gh');
    expect(mapProviderToHubtelChannel('AIRTEL')).toBe('tigo-gh');
    expect(mapProviderToHubtelChannel('VODAFONE')).toBe('vodafone-gh');
    expect(mapProviderToHubtelChannel('UNKNOWN')).toBeNull();
  });

  it('normalizes Hubtel statuses', () => {
    expect(normalizeHubtelPaymentStatus({ ResponseCode: '0000' })).toBe('SUCCESSFUL');
    expect(normalizeHubtelPaymentStatus({ ResponseCode: '0001' })).toBe('PENDING');
    expect(normalizeHubtelPaymentStatus({ Status: 'Failed' })).toBe('FAILED');
  });

  it('initiates Receive Money with Basic auth and stable clientReference', async () => {
    axios.post.mockResolvedValue({
      status: 200,
      data: {
        ResponseCode: '0001',
        Message: 'Pending approval',
        Data: { TransactionId: 'HTX-1' }
      }
    });

    const result = await initiateReceiveMoney({
      config,
      phoneNumber: '0241234567',
      amount: 12.5,
      provider: 'MTN',
      clientReference: 'SALE-abc-123',
      customerName: 'Ama',
      description: 'POS sale'
    });

    expect(result.success).toBe(true);
    expect(result.provider).toBe('HUBTEL');
    expect(result.referenceId).toBe('SALE-abc-123');
    expect(result.hubtelTransactionId).toBe('HTX-1');
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/POS-99/receive/mobilemoney'),
      expect.objectContaining({
        CustomerMsisdn: '0241234567',
        Channel: 'mtn-gh',
        Amount: 12.5,
        ClientReference: 'SALE-abc-123',
        PrimaryCallbackUrl: 'https://api.example.com/api/webhooks/hubtel'
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: expect.stringMatching(/^Basic /)
        })
      })
    );
  });

  it('rejects missing POS Sales ID', async () => {
    const result = await initiateReceiveMoney({
      config: { clientId: 'c', clientSecret: 's' },
      phoneNumber: '0241234567',
      amount: 1,
      provider: 'MTN',
      clientReference: 'ref-1'
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/POS Sales ID/i);
  });

  it('checks status by clientReference', async () => {
    axios.get.mockResolvedValue({
      status: 200,
      data: { ResponseCode: '0000', Status: 'Success', Data: { TransactionId: 'HTX-9' } }
    });

    const result = await checkReceiveMoneyStatus({
      config,
      clientReference: 'INV-PUB-1'
    });

    expect(result.status).toBe('SUCCESSFUL');
    expect(result.financialTransactionId).toBe('HTX-9');
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining('/POS-99/status'),
      expect.objectContaining({
        params: { clientReference: 'INV-PUB-1' }
      })
    );
  });

  it('parses webhook callback payloads', () => {
    const parsed = parseHubtelCallback({
      ResponseCode: '0000',
      Data: {
        ClientReference: 'SALE-1',
        TransactionId: 'TX-22',
        Amount: 5,
        Status: 'Success'
      }
    });
    expect(parsed.clientReference).toBe('SALE-1');
    expect(parsed.status).toBe('SUCCESSFUL');
    expect(parsed.transactionId).toBe('TX-22');
  });
});
