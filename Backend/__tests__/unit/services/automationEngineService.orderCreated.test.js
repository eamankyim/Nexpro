jest.mock('../../../models', () => ({
  AutomationRule: { findAll: jest.fn() },
  AutomationRun: { findOne: jest.fn(), create: jest.fn() },
  Customer: {},
  Invoice: {},
  Job: {},
  Lead: {},
  Prescription: {},
  PrescriptionItem: {},
  Product: {},
  Quote: {},
  Sale: {},
  SaleItem: {},
  Tenant: { findByPk: jest.fn() },
  User: {},
  UserTask: {},
}));

jest.mock('../../../services/emailService', () => ({ sendPlatformMessage: jest.fn() }));
jest.mock('../../../services/smsService', () => ({ sendMessage: jest.fn() }));
jest.mock('../../../services/whatsappService', () => ({
  sendMessage: jest.fn(),
  formatCurrency: (n) => `GHS ${Number(n).toFixed(2)}`,
}));
jest.mock('../../../services/emailTemplates', () => ({ marketingPlainMessageEmail: jest.fn((body) => body) }));
jest.mock('../../../utils/resolveBusinessNameForContext', () => ({
  resolveBusinessNameForContext: jest.fn(),
}));
jest.mock('../../../utils/orderTrackingLink', () => ({
  resolveOrderTrackingLink: jest.fn(),
  buildOrderTrackingLink: jest.fn(),
}));

const { resolveBusinessNameForContext } = require('../../../utils/resolveBusinessNameForContext');
const { resolveOrderTrackingLink } = require('../../../utils/orderTrackingLink');
const { AutomationRule, AutomationRun } = require('../../../models');
const {
  buildOrderCreatedTriggerContext,
  runOrderCreatedAutomations,
  getTemplateByKey,
} = require('../../../services/automationEngineService');

describe('automationEngineService order_created', () => {
  const originalFrontendUrl = process.env.FRONTEND_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.FRONTEND_URL = 'https://app.example.com';
    resolveBusinessNameForContext.mockResolvedValue({ businessName: 'Kitchen Co', branchName: 'Main' });
    AutomationRun.findOne.mockResolvedValue(null);
    AutomationRun.create.mockResolvedValue({ id: 'run-1' });
    AutomationRule.findAll.mockResolvedValue([]);
  });

  afterEach(() => {
    process.env.FRONTEND_URL = originalFrontendUrl;
  });

  it('exposes order_created_notification template with tracking placeholders', () => {
    const template = getTemplateByKey('order_created_notification');
    expect(template).toBeTruthy();
    expect(template.triggerType).toBe('order_created');
    const sms = template.actionConfig.actions.find((a) => a.type === 'send_sms');
    expect(sms.body).toContain('{{trackingLink}}');
    expect(sms.body).toContain('{{orderNumber}}');
    expect(sms.body).not.toMatch(/ETA|ready in|minutes/i);
  });

  it('builds order_created context with tracking link fields', () => {
    const context = buildOrderCreatedTriggerContext({
      sale: {
        id: 'sale-1',
        saleNumber: 'ORD-42',
        total: 85,
        shopId: 'shop-1',
        customerId: 'c-1',
      },
      customer: {
        id: 'c-1',
        name: 'Ama',
        phone: '+233200000000',
        email: 'ama@example.com',
        smsConsent: true,
      },
      trackingLink: 'https://app.example.com/track/kitchen-co?order=ORD-42',
    });

    expect(context.subjectKey).toBe('order_created:sale-1');
    expect(context.orderNumber).toBe('ORD-42');
    expect(context.saleNumber).toBe('ORD-42');
    expect(context.customerName).toBe('Ama');
    expect(context.trackingLink).toBe('https://app.example.com/track/kitchen-co?order=ORD-42');
    expect(context.trackingUrl).toBe(context.trackingLink);
    expect(context.trackingLinkLine).toBe(
      'Track your order: https://app.example.com/track/kitchen-co?order=ORD-42'
    );
    expect(context.hasTrackingLink).toBe(true);
    expect(context.message).toContain('Track here:');
    expect(context.message).not.toMatch(/ETA|ready in|minutes/i);
  });

  it('omits tracking line when link is missing', () => {
    const context = buildOrderCreatedTriggerContext({
      sale: { id: 'sale-2', saleNumber: 'ORD-7', total: 10 },
      customer: { name: 'Kojo' },
      trackingLink: null,
    });
    expect(context.trackingLink).toBeNull();
    expect(context.trackingLinkLine).toBe('');
    expect(context.hasTrackingLink).toBe(false);
  });

  it('runs order_created automations after resolving tracking link', async () => {
    resolveOrderTrackingLink.mockResolvedValue(
      'https://app.example.com/track/kitchen-co?order=ORD-42'
    );
    AutomationRule.findAll.mockResolvedValue([
      {
        id: 'r1',
        enabled: true,
        triggerType: 'order_created',
        actionConfig: { actions: [] },
        scheduleConfig: {},
        conditionConfig: {},
        metadata: { templateKey: 'order_created_notification' },
      },
    ]);

    const summary = await runOrderCreatedAutomations({
      tenantId: 'tenant-1',
      sale: { id: 'sale-1', saleNumber: 'ORD-42', total: 85, customerId: 'c-1' },
      customer: { id: 'c-1', name: 'Ama', phone: '+233200000000' },
    });

    expect(resolveOrderTrackingLink).toHaveBeenCalledWith('tenant-1', {
      orderNumber: 'ORD-42',
    });
    expect(summary.rulesChecked).toBe(1);
  });

  it('skips when sale is missing', async () => {
    const result = await runOrderCreatedAutomations({ tenantId: 't1', sale: null });
    expect(result).toEqual({ skipped: true, reason: 'missing_sale' });
  });

  it('skips when customer is missing', async () => {
    const result = await runOrderCreatedAutomations({
      tenantId: 't1',
      sale: { id: 'sale-1', saleNumber: 'ORD-1' },
      customer: null,
    });
    expect(result).toEqual({ skipped: true, reason: 'missing_customer' });
  });
});
