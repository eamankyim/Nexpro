jest.mock('../../../models', () => ({
  AutomationRule: { findAll: jest.fn() },
  AutomationRun: { findOne: jest.fn(), create: jest.fn() },
  Customer: { findAll: jest.fn() },
  Invoice: { findAll: jest.fn() },
  Job: { findAll: jest.fn() },
  Lead: { findAll: jest.fn() },
  Prescription: { findAll: jest.fn() },
  PrescriptionItem: {},
  Product: {},
  Quote: {},
  Sale: { findAll: jest.fn(), findOne: jest.fn() },
  SaleItem: {},
  Tenant: {},
  UserTask: { create: jest.fn() },
}));

jest.mock('../../../services/emailService', () => ({ sendPlatformMessage: jest.fn() }));
jest.mock('../../../services/smsService', () => ({ sendMessage: jest.fn() }));
jest.mock('../../../services/whatsappService', () => ({ sendMessage: jest.fn(), formatCurrency: (n) => `GHS ${n}` }));
jest.mock('../../../services/emailTemplates', () => ({ marketingPlainMessageEmail: jest.fn((body) => body) }));
jest.mock('../../../utils/resolveBusinessNameForContext', () => ({
  resolveBusinessNameForContext: jest.fn(),
}));

const { resolveBusinessNameForContext } = require('../../../utils/resolveBusinessNameForContext');
const {
  buildCustomerCreatedTriggerContext,
  buildSaleCompletedTriggerContext,
  buildInvoiceSentTriggerContext,
  buildQuoteSentTriggerContext,
  calculateSaleProfitMargin,
  productStockContext,
  runCustomerCreatedAutomations,
  runSaleCompletedAutomations,
  runStockChangeAutomations,
  getTriggerContextsForRule,
} = require('../../../services/automationEngineService');
const { AutomationRule, AutomationRun, Lead, Job, Prescription } = require('../../../models');

describe('automationEngineService event triggers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveBusinessNameForContext.mockResolvedValue({ businessName: 'Test Biz', branchName: '' });
    AutomationRun.findOne.mockResolvedValue(null);
    AutomationRun.create.mockResolvedValue({ id: 'run-1' });
    AutomationRule.findAll.mockResolvedValue([]);
  });

  it('builds customer_created context', () => {
    const context = buildCustomerCreatedTriggerContext({ id: 'c-1', name: 'Jane', email: 'j@x.com' });
    expect(context.subjectKey).toBe('customer_created:c-1');
    expect(context.customerName).toBe('Jane');
  });

  it('runs customer_created automations', async () => {
    AutomationRule.findAll.mockResolvedValue([{ id: 'r1', enabled: true, triggerType: 'customer_created', actionConfig: { actions: [] }, scheduleConfig: {}, conditionConfig: {} }]);
    const summary = await runCustomerCreatedAutomations({ tenantId: 't1', customer: { id: 'c1', name: 'Jane' } });
    expect(summary.rulesChecked).toBe(1);
  });

  it('builds sale_completed context', () => {
    const context = buildSaleCompletedTriggerContext({ id: 's1', saleNumber: 'S-1', total: 120, status: 'completed' }, { name: 'Buyer' });
    expect(context.saleNumber).toBe('S-1');
    expect(context.totalAmountFormatted).toContain('120');
  });

  it('skips sale_completed when sale not completed', async () => {
    const result = await runSaleCompletedAutomations({ tenantId: 't1', sale: { id: 's1', status: 'pending' } });
    expect(result.skipped).toBe(true);
  });

  it('calculates low profit margin from item costs', () => {
    const margin = calculateSaleProfitMargin(
      { total: 100 },
      [{ productId: 'p1', quantity: 2 }],
      new Map([['p1', { costPrice: 40 }]])
    );
    expect(margin.profitMargin).toBe(20);
  });

  it('routes stock auto event to out_of_stock trigger', async () => {
    AutomationRule.findAll.mockResolvedValue([{ id: 'r1', enabled: true, triggerType: 'out_of_stock_detected', actionConfig: { actions: [] }, scheduleConfig: {}, conditionConfig: {} }]);
    await runStockChangeAutomations({
      tenantId: 't1',
      product: { id: 'p1', name: 'Widget', quantityOnHand: 0, reorderLevel: 5, trackStock: true },
      stockEvent: 'auto',
    });
    expect(AutomationRule.findAll).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ triggerType: 'out_of_stock_detected' }) }));
  });

  it('builds product stock context', () => {
    const context = productStockContext({ id: 'p1', name: 'Ink', sku: 'INK-1', quantityOnHand: 2, reorderLevel: 5 });
    expect(context.productName).toBe('Ink');
    expect(context.quantityOnHand).toBe(2);
  });
});

describe('automationEngineService scheduler triggers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveBusinessNameForContext.mockResolvedValue({ businessName: 'Pharm', branchName: '' });
  });

  it('returns lead_no_contact_days contexts', async () => {
    Lead.findAll.mockResolvedValue([{ id: 'l1', name: 'Lead A', source: 'web', company: 'Co', email: null, phone: null }]);
    const contexts = await getTriggerContextsForRule({
      tenantId: 't1',
      triggerType: 'lead_no_contact_days',
      triggerConfig: { noContactDays: 3 },
    });
    expect(contexts).toHaveLength(1);
    expect(contexts[0].leadName).toBe('Lead A');
  });

  it('returns job_due_in_hours contexts', async () => {
    const due = new Date(Date.now() + 2 * 60 * 60 * 1000);
    Job.findAll.mockResolvedValue([{
      id: 'j1',
      jobNumber: 'JOB-1',
      dueDate: due,
      customer: { id: 'c1', name: 'Client', email: 'c@x.com', phone: '+233200000000' },
    }]);
    const contexts = await getTriggerContextsForRule({
      tenantId: 't1',
      triggerType: 'job_due_in_hours',
      triggerConfig: { hoursBeforeDue: 24 },
    });
    expect(contexts[0].jobNumber).toBe('JOB-1');
  });

  it('returns prescription_refill_due contexts from metadata', async () => {
    const refillDue = new Date();
    refillDue.setDate(refillDue.getDate() + 2);
    Prescription.findAll.mockResolvedValue([{
      id: 'rx1',
      prescriptionNumber: 'RX-1',
      status: 'filled',
      filledAt: new Date(),
      metadata: { refillDueDate: refillDue.toISOString().slice(0, 10) },
      customer: { id: 'c1', name: 'Patient' },
      items: [{ duration: '30 days' }],
    }]);
    const contexts = await getTriggerContextsForRule({
      tenantId: 't1',
      triggerType: 'prescription_refill_due',
      triggerConfig: { daysBeforeDue: 3 },
    });
    expect(contexts).toHaveLength(1);
    expect(contexts[0].prescriptionNumber).toBe('RX-1');
  });
});
