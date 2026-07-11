jest.mock('../../../models', () => ({
  AutomationRule: { findAll: jest.fn(), findOne: jest.fn() },
  Setting: { findOne: jest.fn() },
  SaleActivity: { findOne: jest.fn(), create: jest.fn() },
}));

const { AutomationRule, Setting, SaleActivity } = require('../../../models');
const bridge = require('../../../services/customerNotificationBridgeService');

describe('customerNotificationBridgeService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AutomationRule.findOne.mockResolvedValue(null);
  });

  it('returns effective enabled when setting is on', async () => {
    const result = await bridge.isCustomerNotificationEffectiveEnabled('tenant-1', {
      settingEnabled: true,
      templateKey: bridge.TEMPLATE_KEYS.INVOICE_SENT,
    });
    expect(result).toBe(true);
    expect(AutomationRule.findAll).not.toHaveBeenCalled();
  });

  it('returns effective enabled when matching automation rule is enabled', async () => {
    AutomationRule.findAll.mockResolvedValue([
      { id: 'rule-1', enabled: true, metadata: { templateKey: bridge.TEMPLATE_KEYS.SALE_COMPLETED_RECEIPT } },
    ]);

    const result = await bridge.isCustomerNotificationEffectiveEnabled('tenant-1', {
      settingEnabled: false,
      templateKey: bridge.TEMPLATE_KEYS.SALE_COMPLETED_RECEIPT,
    });

    expect(result).toBe(true);
  });

  it('prefers automation over built-in when rule is enabled', async () => {
    AutomationRule.findAll.mockResolvedValue([
      { id: 'rule-1', enabled: true, metadata: { templateKey: bridge.TEMPLATE_KEYS.PAYMENT_RECEIVED_THANK_YOU } },
    ]);

    const useAutomation = await bridge.shouldUseAutomationInsteadOfBuiltIn(
      'tenant-1',
      bridge.TEMPLATE_KEYS.PAYMENT_RECEIVED_THANK_YOU
    );

    expect(useAutomation).toBe(true);
  });

  it('skips built-in overdue reminders when any invoice_overdue automation is enabled', async () => {
    AutomationRule.findAll.mockResolvedValue([]);
    AutomationRule.findOne.mockResolvedValue({
      id: 'rule-overdue',
      enabled: true,
      triggerType: 'invoice_overdue',
    });

    const useAutomation = await bridge.shouldUseAutomationInsteadOfBuiltIn(
      'tenant-1',
      bridge.TEMPLATE_KEYS.OVERDUE_INVOICE_REMINDER
    );

    expect(useAutomation).toBe(true);
    expect(AutomationRule.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          enabled: true,
          triggerType: 'invoice_overdue',
        }),
      })
    );
  });

  it('detects recent receipt activity within dedupe window', async () => {
    SaleActivity.findOne.mockResolvedValue({ id: 'activity-1' });

    const recent = await bridge.hasRecentReceiptForSale('tenant-1', 'sale-1');
    expect(recent).toBe(true);
    expect(SaleActivity.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          saleId: 'sale-1',
          type: 'receipt_sent',
        }),
      })
    );
  });

  it('detects POS auto_send receipt mode', async () => {
    Setting.findOne.mockResolvedValue({ value: { receipt: { mode: 'auto_send' } } });
    expect(await bridge.isPosAutoSendReceiptEnabled('tenant-1')).toBe(true);

    Setting.findOne.mockResolvedValue({ value: { receipt: { mode: 'ask' } } });
    expect(await bridge.isPosAutoSendReceiptEnabled('tenant-1')).toBe(false);
  });
});
