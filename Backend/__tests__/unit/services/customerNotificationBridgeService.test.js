jest.mock('../../../models', () => ({
  AutomationRule: { findAll: jest.fn(), findOne: jest.fn() },
  Setting: { findOne: jest.fn() },
  SaleActivity: { findAll: jest.fn(), findOne: jest.fn(), create: jest.fn() },
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

  it('detects recent receipt activity within dedupe window (global check)', async () => {
    SaleActivity.findAll.mockResolvedValue([{ id: 'activity-1', metadata: { channels: ['email'] } }]);

    const recent = await bridge.hasRecentReceiptForSale('tenant-1', 'sale-1');
    expect(recent).toBe(true);
    expect(SaleActivity.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          saleId: 'sale-1',
          type: 'receipt_sent',
        }),
      })
    );
  });

  it('does not dedupe a channel that was not part of the recent receipt activity', async () => {
    // Auto-send only succeeded for email — a manual "Send SMS" should not be blocked.
    SaleActivity.findAll.mockResolvedValue([{ id: 'activity-1', metadata: { channels: ['email'] } }]);

    expect(await bridge.hasRecentReceiptForSale('tenant-1', 'sale-1', 'sms')).toBe(false);
    expect(await bridge.hasRecentReceiptForSale('tenant-1', 'sale-1', 'email')).toBe(true);
  });

  it('detects POS auto_send receipt mode', async () => {
    Setting.findOne.mockResolvedValue({ value: { receipt: { mode: 'auto_send' } } });
    expect(await bridge.isPosAutoSendReceiptEnabled('tenant-1')).toBe(true);

    Setting.findOne.mockResolvedValue({ value: { receipt: { mode: 'ask' } } });
    expect(await bridge.isPosAutoSendReceiptEnabled('tenant-1')).toBe(false);
  });

  describe('getAutomationCoveredChannelsForTemplate', () => {
    it('only covers channels the enabled automation rule actually sends', async () => {
      AutomationRule.findAll.mockResolvedValue([
        {
          id: 'rule-1',
          enabled: true,
          metadata: { templateKey: bridge.TEMPLATE_KEYS.SALE_COMPLETED_RECEIPT },
          actionConfig: {
            actions: [
              { type: 'send_whatsapp' },
              { type: 'send_email_platform' },
            ],
          },
        },
      ]);

      const covered = await bridge.getAutomationCoveredChannelsForTemplate(
        'tenant-1',
        bridge.TEMPLATE_KEYS.SALE_COMPLETED_RECEIPT
      );

      expect(covered.has('whatsapp')).toBe(true);
      expect(covered.has('email')).toBe(true);
      expect(covered.has('sms')).toBe(false);
    });

    it('returns an empty set when no automation rule matches', async () => {
      AutomationRule.findAll.mockResolvedValue([]);
      AutomationRule.findOne.mockResolvedValue(null);

      const covered = await bridge.getAutomationCoveredChannelsForTemplate(
        'tenant-1',
        bridge.TEMPLATE_KEYS.SALE_COMPLETED_RECEIPT
      );

      expect(covered.size).toBe(0);
    });

    it('isChannelHandledByAutomation reflects the covered-channel set', async () => {
      AutomationRule.findAll.mockResolvedValue([
        {
          id: 'rule-1',
          enabled: true,
          metadata: { templateKey: bridge.TEMPLATE_KEYS.SALE_COMPLETED_RECEIPT },
          actionConfig: { actions: [{ type: 'send_sms' }] },
        },
      ]);

      expect(
        await bridge.isChannelHandledByAutomation('tenant-1', bridge.TEMPLATE_KEYS.SALE_COMPLETED_RECEIPT, 'sms')
      ).toBe(true);
      expect(
        await bridge.isChannelHandledByAutomation('tenant-1', bridge.TEMPLATE_KEYS.SALE_COMPLETED_RECEIPT, 'email')
      ).toBe(false);
    });

    it('matches custom sale_completed rules and ignores staff/internal rules', async () => {
      AutomationRule.findAll.mockResolvedValue([
        {
          id: 'staff-rule',
          enabled: true,
          triggerType: 'sale_completed_staff',
          metadata: { templateKey: 'sale_completed_staff', audience: 'internal' },
          actionConfig: { actions: [{ type: 'send_sms', audience: 'internal' }] },
        },
        {
          id: 'custom-rule',
          enabled: true,
          triggerType: 'sale_completed',
          metadata: {},
          actionConfig: { actions: [{ type: 'send_sms' }, { type: 'send_email_platform' }] },
        },
      ]);

      const covered = await bridge.getAutomationCoveredChannelsForTemplate(
        'tenant-1',
        bridge.TEMPLATE_KEYS.SALE_COMPLETED_RECEIPT
      );

      expect(covered.has('sms')).toBe(true);
      expect(covered.has('email')).toBe(true);
      expect(covered.size).toBe(2);
    });

    it('getSaleReceiptAutomationCoverage returns API-friendly booleans', async () => {
      AutomationRule.findAll.mockResolvedValue([
        {
          id: 'rule-1',
          enabled: true,
          metadata: { templateKey: bridge.TEMPLATE_KEYS.SALE_COMPLETED_RECEIPT },
          actionConfig: { actions: [{ type: 'send_whatsapp' }] },
        },
      ]);

      const coverage = await bridge.getSaleReceiptAutomationCoverage('tenant-1');

      expect(coverage).toEqual({ sms: false, email: false, whatsapp: true });
    });
  });
});
