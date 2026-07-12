jest.mock('../../../models', () => ({
  AutomationRule: { findAll: jest.fn() },
  AutomationRun: { findOne: jest.fn(), create: jest.fn() },
  Customer: { findAll: jest.fn() },
  Invoice: { findAll: jest.fn() },
  Job: { findAll: jest.fn() },
  Lead: { findAll: jest.fn() },
  Prescription: { findAll: jest.fn() },
  PrescriptionItem: {},
  Product: { findAll: jest.fn() },
  Quote: { findAll: jest.fn() },
  Sale: { findAll: jest.fn(), findOne: jest.fn() },
  SaleItem: {},
  Tenant: {},
  User: {},
  UserTask: { create: jest.fn() },
}));

jest.mock('../../../services/emailService', () => ({ sendPlatformMessage: jest.fn() }));
jest.mock('../../../services/smsService', () => ({ sendMessage: jest.fn() }));
jest.mock('../../../services/whatsappService', () => ({ sendMessage: jest.fn(), formatCurrency: (n) => `GHS ${n}` }));
jest.mock('../../../services/emailTemplates', () => ({ marketingPlainMessageEmail: jest.fn((body) => body) }));
jest.mock('../../../utils/resolveBusinessNameForContext', () => {
  const actual = jest.requireActual('../../../utils/resolveBusinessNameForContext');
  return {
    ...actual,
    resolveBusinessNameForContext: jest.fn(),
  };
});

const { resolveBusinessNameForContext } = require('../../../utils/resolveBusinessNameForContext');
const {
  AutomationRule,
  AutomationRun,
  Customer,
  Invoice,
  Job,
  Lead,
  Product,
  Quote,
} = require('../../../models');
const {
  executeMatchingRules,
  runLowProfitMarginAutomations,
  getTriggerContextsForRule,
} = require('../../../services/automationEngineService');

describe('automationEngineService branch scoping', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveBusinessNameForContext.mockResolvedValue({ businessName: 'Biz', branchName: '' });
    AutomationRun.findOne.mockResolvedValue(null);
    AutomationRun.create.mockResolvedValue({ id: 'run-1' });
  });

  describe('executeMatchingRules', () => {
    const baseRule = {
      id: 'r1',
      enabled: true,
      triggerType: 'payment_received',
      actionConfig: { actions: [] },
      scheduleConfig: {},
      conditionConfig: {},
    };

    it('runs an all-branch rule (shopId/studioLocationId null) regardless of the event branch', async () => {
      AutomationRule.findAll.mockResolvedValue([{ ...baseRule, shopId: null, studioLocationId: null }]);

      const summary = await executeMatchingRules({
        tenantId: 't1',
        triggerType: 'payment_received',
        triggerContext: { shopId: 'shop-a' },
      });

      expect(summary.rulesChecked).toBe(1);
      expect(summary.skipped).toBe(0);
      expect(AutomationRun.create).toHaveBeenCalledTimes(1);
    });

    it('skips a shop-scoped rule when the event belongs to a different shop', async () => {
      AutomationRule.findAll.mockResolvedValue([{ ...baseRule, shopId: 'shop-a', studioLocationId: null }]);

      const summary = await executeMatchingRules({
        tenantId: 't1',
        triggerType: 'payment_received',
        triggerContext: { shopId: 'shop-b' },
      });

      expect(summary.rulesChecked).toBe(1);
      expect(summary.skipped).toBe(1);
      expect(AutomationRun.create).not.toHaveBeenCalled();
    });

    it('runs a shop-scoped rule when the event matches its shop', async () => {
      AutomationRule.findAll.mockResolvedValue([{ ...baseRule, shopId: 'shop-a', studioLocationId: null }]);

      const summary = await executeMatchingRules({
        tenantId: 't1',
        triggerType: 'payment_received',
        triggerContext: { shopId: 'shop-a' },
      });

      expect(summary.skipped).toBe(0);
      expect(AutomationRun.create).toHaveBeenCalledTimes(1);
    });

    it('resolves the event branch from nested invoice/job/customer/product context', async () => {
      AutomationRule.findAll.mockResolvedValue([{ ...baseRule, shopId: null, studioLocationId: 'loc-1' }]);

      const summary = await executeMatchingRules({
        tenantId: 't1',
        triggerType: 'payment_received',
        triggerContext: { invoice: { studioLocationId: 'loc-1' } },
      });

      expect(summary.skipped).toBe(0);
      expect(AutomationRun.create).toHaveBeenCalledTimes(1);
    });

    it('skips a studio-location-scoped rule when the event has no matching location', async () => {
      AutomationRule.findAll.mockResolvedValue([{ ...baseRule, shopId: null, studioLocationId: 'loc-1' }]);

      const summary = await executeMatchingRules({
        tenantId: 't1',
        triggerType: 'payment_received',
        triggerContext: { job: { studioLocationId: 'loc-2' } },
      });

      expect(summary.skipped).toBe(1);
      expect(AutomationRun.create).not.toHaveBeenCalled();
    });
  });

  describe('runLowProfitMarginAutomations branch scoping', () => {
    it('skips a shop-scoped rule when the sale is for a different shop', async () => {
      AutomationRule.findAll.mockResolvedValue([{
        id: 'r1',
        enabled: true,
        triggerType: 'low_profit_margin',
        triggerConfig: { minMarginPercent: 50 },
        actionConfig: { actions: [] },
        shopId: 'shop-a',
        studioLocationId: null,
      }]);

      const summary = await runLowProfitMarginAutomations({
        tenantId: 't1',
        sale: { id: 's1', total: 100, shopId: 'shop-b' },
        saleItems: [],
      });

      expect(summary.skipped).toBe(1);
      expect(summary.executed).toBe(0);
    });

    it('executes a shop-scoped rule when the sale matches the branch', async () => {
      AutomationRule.findAll.mockResolvedValue([{
        id: 'r1',
        enabled: true,
        triggerType: 'low_profit_margin',
        triggerConfig: { minMarginPercent: 50 },
        actionConfig: { actions: [] },
        shopId: 'shop-a',
        studioLocationId: null,
      }]);

      const summary = await runLowProfitMarginAutomations({
        tenantId: 't1',
        sale: { id: 's1', total: 100, shopId: 'shop-a' },
        saleItems: [{ productId: 'p1', quantity: 2 }],
        productsById: new Map([['p1', { costPrice: 40 }]]),
      });

      expect(summary.skipped).toBe(0);
      expect(summary.executed).toBe(1);
    });
  });

  describe('getTriggerContextsForRule pushes branch scope into subject queries', () => {
    beforeEach(() => {
      Invoice.findAll.mockResolvedValue([]);
      Product.findAll.mockResolvedValue([]);
      Quote.findAll.mockResolvedValue([]);
      Customer.findAll.mockResolvedValue([]);
      Lead.findAll.mockResolvedValue([]);
      Job.findAll.mockResolvedValue([]);
    });

    it('filters invoice_overdue subjects by rule.shopId', async () => {
      await getTriggerContextsForRule({
        tenantId: 't1',
        triggerType: 'invoice_overdue',
        triggerConfig: {},
        shopId: 'shop-a',
        studioLocationId: null,
      }, new Date());

      expect(Invoice.findAll).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ shopId: 'shop-a' }),
      }));
    });

    it('does not add a shopId filter for all-branch rules', async () => {
      await getTriggerContextsForRule({
        tenantId: 't1',
        triggerType: 'invoice_overdue',
        triggerConfig: {},
        shopId: null,
        studioLocationId: null,
      }, new Date());

      const where = Invoice.findAll.mock.calls[0][0].where;
      expect(where).not.toHaveProperty('shopId');
      expect(where).not.toHaveProperty('studioLocationId');
    });

    it('filters low_stock_detected products by rule.shopId', async () => {
      await getTriggerContextsForRule({
        tenantId: 't1',
        triggerType: 'low_stock_detected',
        triggerConfig: {},
        shopId: 'shop-a',
      }, new Date());

      expect(Product.findAll).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ shopId: 'shop-a' }),
      }));
    });

    it('filters job_due_in_hours jobs by rule.studioLocationId', async () => {
      await getTriggerContextsForRule({
        tenantId: 't1',
        triggerType: 'job_due_in_hours',
        triggerConfig: {},
        studioLocationId: 'loc-1',
      }, new Date());

      expect(Job.findAll).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ studioLocationId: 'loc-1' }),
      }));
    });

    it('filters lead_no_contact_days leads by rule branch scope', async () => {
      await getTriggerContextsForRule({
        tenantId: 't1',
        triggerType: 'lead_no_contact_days',
        triggerConfig: {},
        shopId: 'shop-a',
      }, new Date());

      expect(Lead.findAll).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ shopId: 'shop-a' }),
      }));
    });

    it('filters quote_no_response quotes by rule branch scope', async () => {
      await getTriggerContextsForRule({
        tenantId: 't1',
        triggerType: 'quote_no_response',
        triggerConfig: {},
        studioLocationId: 'loc-1',
      }, new Date());

      expect(Quote.findAll).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ studioLocationId: 'loc-1' }),
      }));
    });

    it('filters customer_inactive_days customers by rule branch scope', async () => {
      await getTriggerContextsForRule({
        tenantId: 't1',
        triggerType: 'customer_inactive_days',
        triggerConfig: {},
        shopId: 'shop-a',
      }, new Date());

      expect(Customer.findAll).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ shopId: 'shop-a' }),
      }));
    });
  });
});
