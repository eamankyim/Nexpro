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
  Tenant: {},
  UserTask: { create: jest.fn() },
}));

jest.mock('../../../services/emailService', () => ({ sendPlatformMessage: jest.fn() }));
jest.mock('../../../services/smsService', () => ({ sendMessage: jest.fn() }));
jest.mock('../../../services/whatsappService', () => ({ sendMessage: jest.fn() }));
jest.mock('../../../services/emailTemplates', () => ({ marketingPlainMessageEmail: jest.fn((body) => body) }));
jest.mock('../../../utils/resolveBusinessNameForContext', () => ({
  resolveBusinessNameForContext: jest.fn(),
}));

const { resolveBusinessNameForContext } = require('../../../utils/resolveBusinessNameForContext');
const {
  buildHighValueInvoiceTriggerContext,
  runHighValueInvoiceAutomations,
  triggerConfigAllowsRun,
} = require('../../../services/automationEngineService');
const { AutomationRule, AutomationRun } = require('../../../models');

describe('automationEngineService high_value_invoice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveBusinessNameForContext.mockResolvedValue({ businessName: 'HQ', branchName: '' });
    AutomationRun.findOne.mockResolvedValue(null);
    AutomationRun.create.mockResolvedValue({ id: 'run-1' });
  });

  it('builds invoice amount context', () => {
    const context = buildHighValueInvoiceTriggerContext(
      { id: 'inv-1', invoiceNumber: 'INV-900', totalAmount: 5000, customerId: 'c-1' },
      { id: 'c-1', name: 'Big Client' }
    );
    expect(context.totalAmount).toBe(5000);
    expect(context.customerName).toBe('Big Client');
    expect(context.totalAmountFormatted).toContain('5,000');
  });

  it('skips rules below min amount threshold', () => {
    const check = triggerConfigAllowsRun(
      { triggerType: 'high_value_invoice', triggerConfig: { minAmount: 1000 } },
      { totalAmount: 500 }
    );
    expect(check.allowed).toBe(false);
  });

  it('executes when amount exceeds threshold', async () => {
    AutomationRule.findAll.mockResolvedValue([{
      id: 'rule-1',
      enabled: true,
      triggerType: 'high_value_invoice',
      triggerConfig: { minAmount: 1000 },
      actionConfig: { actions: [{ type: 'create_task', title: 'Alert' }] },
      scheduleConfig: {},
      conditionConfig: {},
    }]);
    const summary = await runHighValueInvoiceAutomations({
      tenantId: 'tenant-1',
      invoice: { id: 'inv-1', invoiceNumber: 'INV-1', totalAmount: 2500 },
      customer: { id: 'c-1', name: 'Client' },
      actorUserId: 'user-1',
    });
    expect(summary.rulesChecked).toBe(1);
  });
});
