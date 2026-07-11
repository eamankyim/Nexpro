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
  isCustomerNotificationEffectiveEnabled: jest.fn(),
  shouldUseAutomationInsteadOfBuiltIn: jest.fn(),
  isPosAutoSendReceiptEnabled: jest.fn(),
  hasRecentReceiptForSale: jest.fn(),
  recordReceiptSentActivity: jest.fn(),
}));

jest.mock('../../../services/messageDeliveryRulesService', () => ({
  isChannelEnabledForEvent: jest.fn().mockResolvedValue(false),
}));

jest.mock('../../../services/smsService', () => ({
  getResolvedConfig: jest.fn().mockResolvedValue(null),
  validatePhoneNumber: jest.fn(),
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
    bridge.isCustomerNotificationEffectiveEnabled.mockResolvedValue(true);
    bridge.shouldUseAutomationInsteadOfBuiltIn.mockResolvedValue(false);
    bridge.isPosAutoSendReceiptEnabled.mockResolvedValue(false);
    bridge.hasRecentReceiptForSale.mockResolvedValue(false);
    bridge.recordReceiptSentActivity.mockResolvedValue(undefined);
  });

  it('skips built-in receipt when sale_completed automation rule is enabled', async () => {
    bridge.shouldUseAutomationInsteadOfBuiltIn.mockResolvedValue(true);

    await saleController.autoSendReceiptIfEnabled('tenant-1', 'sale-1');

    expect(Sale.findOne).not.toHaveBeenCalled();
    expect(bridge.recordReceiptSentActivity).not.toHaveBeenCalled();
  });

  it('skips when a receipt was sent recently for the sale', async () => {
    bridge.hasRecentReceiptForSale.mockResolvedValue(true);

    await saleController.autoSendReceiptIfEnabled('tenant-1', 'sale-1');

    expect(Sale.findOne).not.toHaveBeenCalled();
  });

  it('considers POS auto_send mode as effective receipt setting', async () => {
    Setting.findOne.mockResolvedValue({ value: { autoSendReceiptToCustomer: false } });
    bridge.isPosAutoSendReceiptEnabled.mockResolvedValue(true);
    bridge.isCustomerNotificationEffectiveEnabled.mockImplementation(async (_tenantId, { settingEnabled }) => settingEnabled);
    Sale.findOne.mockResolvedValue(null);

    await saleController.autoSendReceiptIfEnabled('tenant-1', 'sale-1');

    expect(bridge.isCustomerNotificationEffectiveEnabled).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ settingEnabled: true })
    );
  });
});
