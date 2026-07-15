jest.mock('../../../models', () => ({
  Sale: { findOne: jest.fn() },
  SaleItem: {},
  Customer: {},
  Shop: {},
  Tenant: {},
  Setting: { findOne: jest.fn() },
  SaleActivity: { findOne: jest.fn(), create: jest.fn() },
  Product: {},
  Invoice: {},
  User: {},
  Payment: {},
  Barcode: {},
}));

jest.mock('../../../services/customerNotificationBridgeService', () => ({
  TEMPLATE_KEYS: { SALE_COMPLETED_RECEIPT: 'sale_completed_receipt' },
  isPosAutoSendReceiptEnabled: jest.fn(),
  getAutomationCoveredChannelsForTemplate: jest.fn(),
  hasRecentReceiptForSale: jest.fn(),
  recordReceiptSentActivity: jest.fn(),
}));

jest.mock('../../../services/messageDeliveryRulesService', () => ({
  isChannelEnabledForEvent: jest.fn().mockResolvedValue(false),
}));

jest.mock('../../../services/smsService', () => ({
  getResolvedConfig: jest.fn().mockResolvedValue({ provider: 'test' }),
  validatePhoneNumber: jest.fn().mockReturnValue('0240000000'),
}));

jest.mock('../../../services/whatsappService', () => ({
  getConfig: jest.fn().mockResolvedValue(null),
  validatePhoneNumber: jest.fn(),
}));

jest.mock('../../../services/emailService', () => ({
  getConfig: jest.fn().mockResolvedValue(null),
  sendMessage: jest.fn(),
}));

const { Sale, Setting } = require('../../../models');
const bridge = require('../../../services/customerNotificationBridgeService');
const saleController = require('../../../controllers/saleController');

describe('saleController autoSendReceiptIfEnabled dedupe', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    bridge.isPosAutoSendReceiptEnabled.mockResolvedValue(false);
    bridge.getAutomationCoveredChannelsForTemplate.mockResolvedValue(new Set());
    bridge.hasRecentReceiptForSale.mockResolvedValue(false);
    bridge.recordReceiptSentActivity.mockResolvedValue(undefined);
    Setting.findOne.mockResolvedValue({ value: { autoSendReceiptToCustomer: true } });
  });

  it('skips legacy auto-send when neither legacy setting nor POS auto_send is enabled', async () => {
    Setting.findOne.mockResolvedValue({ value: { autoSendReceiptToCustomer: false } });
    bridge.isPosAutoSendReceiptEnabled.mockResolvedValue(false);

    await saleController.autoSendReceiptIfEnabled('tenant-1', 'sale-1');

    expect(Sale.findOne).not.toHaveBeenCalled();
    expect(bridge.recordReceiptSentActivity).not.toHaveBeenCalled();
  });

  it('does not send on channels covered by sale_completed receipt automation', async () => {
    bridge.getAutomationCoveredChannelsForTemplate.mockResolvedValue(new Set(['sms', 'email', 'whatsapp']));
    Sale.findOne.mockResolvedValue({
      customer: { phone: '0240000000', email: 'a@b.com' },
    });

    await saleController.autoSendReceiptIfEnabled('tenant-1', 'sale-1');

    expect(Sale.findOne).toHaveBeenCalled();
    expect(bridge.recordReceiptSentActivity).not.toHaveBeenCalled();
  });

  it('checks per-channel dedupe before sending SMS', async () => {
    const messageDeliveryRulesService = require('../../../services/messageDeliveryRulesService');
    messageDeliveryRulesService.isChannelEnabledForEvent.mockResolvedValue(true);
    bridge.hasRecentReceiptForSale.mockImplementation(async (_tenantId, _saleId, channel) => channel === 'sms');
    Sale.findOne.mockResolvedValue({
      customer: { phone: '0240000000', email: 'a@b.com' },
    });

    await saleController.autoSendReceiptIfEnabled('tenant-1', 'sale-1');

    expect(bridge.hasRecentReceiptForSale).toHaveBeenCalledWith('tenant-1', 'sale-1', 'sms');
  });

  it('considers POS auto_send mode as a legacy auto-send trigger', async () => {
    Setting.findOne.mockResolvedValue({ value: { autoSendReceiptToCustomer: false } });
    bridge.isPosAutoSendReceiptEnabled.mockResolvedValue(true);
    Sale.findOne.mockResolvedValue(null);

    await saleController.autoSendReceiptIfEnabled('tenant-1', 'sale-1');

    expect(bridge.isPosAutoSendReceiptEnabled).toHaveBeenCalledWith('tenant-1');
    expect(Sale.findOne).toHaveBeenCalled();
  });
});
