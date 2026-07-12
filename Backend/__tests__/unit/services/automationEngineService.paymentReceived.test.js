jest.mock('../../../models', () => ({
  AutomationRule: { findAll: jest.fn() },
  AutomationRun: { findOne: jest.fn(), create: jest.fn() },
  Customer: {},
  Invoice: {},
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
  buildPaymentReceivedTriggerContext,
  executeMatchingRules,
} = require('../../../services/automationEngineService');
const { AutomationRule, AutomationRun } = require('../../../models');

describe('automationEngineService payment_received', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveBusinessNameForContext.mockResolvedValue({
      businessName: 'Kofi Prints HQ',
      branchName: '',
    });
    AutomationRun.findOne.mockResolvedValue(null);
    AutomationRun.create.mockResolvedValue({ id: 'run-1' });
  });

  describe('buildPaymentReceivedTriggerContext', () => {
    it('builds customer, invoice, and payment fields for messaging', () => {
      const context = buildPaymentReceivedTriggerContext({
        invoice: {
          id: 'inv-1',
          invoiceNumber: 'INV-1001',
          customerId: 'cust-1',
          totalAmount: 500,
          balance: 200,
          status: 'partial',
          shopId: 'shop-a',
        },
        customer: {
          id: 'cust-1',
          name: 'Ama Mensah',
          email: 'ama@example.com',
          phone: '+233201234567',
          whatsappConsent: true,
          smsConsent: true,
        },
        payment: {
          id: 'pay-1',
          paymentNumber: 'PAY-9001',
          amount: 300,
          paymentMethod: 'mobile_money',
          paymentDate: '2026-07-09T10:00:00.000Z',
        },
        paymentAmount: 300,
        paymentMethod: 'mobile_money',
      });

      expect(context).toMatchObject({
        subjectKey: 'payment_received:inv-1:pay-1',
        invoiceId: 'inv-1',
        invoiceNumber: 'INV-1001',
        customerId: 'cust-1',
        customerName: 'Ama Mensah',
        email: 'ama@example.com',
        phone: '+233201234567',
        amount: 300,
        amountPaid: 300,
        paymentAmount: 300,
        balance: 200,
        totalAmount: 500,
        paymentMethod: 'mobile_money',
        paymentNumber: 'PAY-9001',
        paymentStatus: 'partial',
        shopId: 'shop-a',
        customer: {
          id: 'cust-1',
          name: 'Ama Mensah',
          email: 'ama@example.com',
          phone: '+233201234567',
          whatsappConsent: true,
          smsConsent: true,
        },
        invoice: {
          id: 'inv-1',
          shopId: 'shop-a',
        },
      });
      expect(context.message).toContain('INV-1001');
      expect(context.message).toContain('300');
    });

    it('uses invoice.customer when customer is omitted', () => {
      const context = buildPaymentReceivedTriggerContext({
        invoice: {
          id: 'inv-2',
          invoiceNumber: 'INV-2002',
          customerId: 'cust-2',
          totalAmount: 100,
          balance: 0,
          status: 'paid',
          customer: {
            id: 'cust-2',
            company: 'Acme Ltd',
            phone: '+233209999999',
          },
        },
        payment: {
          id: 'pay-2',
          amount: 100,
          paymentMethod: 'cash',
        },
        paymentAmount: 100,
      });

      expect(context.customerName).toBe('Acme Ltd');
      expect(context.phone).toBe('+233209999999');
      expect(context.paymentStatus).toBe('paid');
    });
  });

  describe('executeMatchingRules', () => {
    it('loads enabled rules for the trigger type and enriches businessName', async () => {
      AutomationRule.findAll.mockResolvedValue([]);

      const summary = await executeMatchingRules({
        tenantId: 'tenant-1',
        triggerType: 'payment_received',
        triggerContext: buildPaymentReceivedTriggerContext({
          invoice: {
            id: 'inv-3',
            invoiceNumber: 'INV-3003',
            customerId: 'cust-3',
            totalAmount: 50,
            balance: 0,
            status: 'paid',
            shopId: 'shop-b',
          },
          payment: { id: 'pay-3', amount: 50, paymentMethod: 'cash' },
          paymentAmount: 50,
        }),
      });

      expect(AutomationRule.findAll).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1', enabled: true, triggerType: 'payment_received' },
        order: [['updatedAt', 'ASC']],
      });
      expect(resolveBusinessNameForContext).toHaveBeenCalledWith(
        'tenant-1',
        expect.objectContaining({
          triggerType: 'payment_received',
          invoiceNumber: 'INV-3003',
          shopId: 'shop-b',
        })
      );
      expect(summary).toEqual({ rulesChecked: 0, executed: 0, skipped: 0, failed: 0, delayed: 0 });
    });
  });
});
