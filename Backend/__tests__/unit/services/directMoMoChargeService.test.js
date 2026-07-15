jest.mock('../../../services/mobileMoneyService', () => ({
  requestPayment: jest.fn()
}));

jest.mock('../../../services/tenantHubtelCollectionService', () => ({
  initiateReceiveMoney: jest.fn(),
  checkReceiveMoneyStatus: jest.fn(),
  getResolvedHubtelConfigForTenant: jest.fn()
}));

jest.mock('../../../services/paymentCollectionRouter', () => ({
  resolveMoMoCollector: jest.fn()
}));

const mobileMoneyService = require('../../../services/mobileMoneyService');
const hubtel = require('../../../services/tenantHubtelCollectionService');
const { resolveMoMoCollector } = require('../../../services/paymentCollectionRouter');
const {
  initiateDirectMoMoCharge,
  buildMobileMoneyRefMeta
} = require('../../../services/directMoMoChargeService');

describe('directMoMoChargeService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('charges via Hubtel when router selects hubtel', async () => {
    resolveMoMoCollector.mockReturnValue({
      rail: 'hubtel',
      hubtelConfig: { clientId: 'c', clientSecret: 's', posSalesId: 'P1' }
    });
    hubtel.initiateReceiveMoney.mockResolvedValue({
      success: true,
      referenceId: 'ref-1',
      clientReference: 'ref-1',
      provider: 'HUBTEL',
      status: 'PENDING',
      message: 'ok'
    });

    const result = await initiateDirectMoMoCharge({
      tenant: {},
      phoneNumber: '0240000000',
      amount: 10,
      provider: 'MTN',
      externalId: 'ref-1'
    });

    expect(result.success).toBe(true);
    expect(result.rail).toBe('hubtel');
    expect(hubtel.initiateReceiveMoney).toHaveBeenCalled();
    expect(mobileMoneyService.requestPayment).not.toHaveBeenCalled();
  });

  it('charges via MTN with merchantId in payeeNote', async () => {
    resolveMoMoCollector.mockReturnValue({
      rail: 'mtn',
      mtnConfig: {
        subscriptionKey: 'sk',
        apiUser: 'u',
        apiKey: 'k',
        merchantId: 'M-9',
        source: 'tenant'
      }
    });
    mobileMoneyService.requestPayment.mockResolvedValue({
      success: true,
      referenceId: 'uuid-1',
      provider: 'MTN',
      status: 'PENDING',
      message: 'prompt sent'
    });

    const result = await initiateDirectMoMoCharge({
      tenant: {},
      phoneNumber: '0240000000',
      amount: 10,
      provider: 'MTN',
      externalId: 'ext-1'
    });

    expect(result.success).toBe(true);
    expect(result.rail).toBe('mtn');
    expect(result.merchantId).toBe('M-9');
    expect(mobileMoneyService.requestPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        payeeNote: expect.stringContaining('merchant:M-9'),
        mtnConfig: expect.objectContaining({ merchantId: 'M-9' })
      })
    );
  });

  it('signals Paystack fallback when direct rail is paystack', async () => {
    resolveMoMoCollector.mockReturnValue({ rail: 'paystack', skipped: [] });

    const result = await initiateDirectMoMoCharge({
      tenant: {},
      phoneNumber: '0240000000',
      amount: 10,
      provider: 'MTN',
      externalId: 'ext-1'
    });

    expect(result.success).toBe(false);
    expect(result.allowPaystackFallback).toBe(true);
    expect(result.error).toMatch(/Paystack/i);
  });

  it('builds mobileMoneyRef metadata for persistence', () => {
    const meta = buildMobileMoneyRefMeta(
      {
        referenceId: 'r1',
        provider: 'HUBTEL',
        status: 'PENDING',
        rail: 'hubtel',
        clientReference: 'r1',
        channel: 'mtn-gh'
      },
      { saleId: 's1' }
    );
    expect(meta.referenceId).toBe('r1');
    expect(meta.provider).toBe('HUBTEL');
    expect(meta.saleId).toBe('s1');
    expect(meta.channel).toBe('mtn-gh');
  });
});
