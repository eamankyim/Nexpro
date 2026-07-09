jest.mock('../../../models', () => ({
  Setting: {
    findOne: jest.fn(),
    findOrCreate: jest.fn(),
  },
}));

const { Setting } = require('../../../models');
const smsTemplateService = require('../../../services/smsTemplateService');
const { formatCustomerSmsMessage } = require('../../../utils/smsMessageUtils');

describe('smsTemplateService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Setting.findOne.mockResolvedValue(null);
    Setting.findOrCreate.mockResolvedValue([{ isNewRecord: true, save: jest.fn() }, true]);
  });

  describe('renderTemplate', () => {
    it('replaces placeholders and prefixes with business name', () => {
      const body = 'Hi {customerName}, invoice {invoiceNumber} for {amount}. Pay: {paymentLink}';
      const message = smsTemplateService.renderTemplate('invoice_sent', body, {
        customerName: 'Ama',
        invoiceNumber: 'INV-100',
        amount: 'GHS 50.00',
        paymentLink: 'https://pay.example/inv',
        businessName: 'Kofi Prints',
      });
      expect(message).toBe(
        formatCustomerSmsMessage(
          'Hi Ama, invoice INV-100 for GHS 50.00. Pay: https://pay.example/inv',
          'Kofi Prints'
        )
      );
    });

    it('prefers branchName over businessName for prefix', () => {
      const message = smsTemplateService.renderTemplate('invoice_sent', 'Test {customerName}', {
        customerName: 'Ama',
        branchName: 'Osu Branch',
        businessName: 'Kofi Prints',
      });
      expect(message.startsWith('Osu Branch:')).toBe(true);
    });
  });

  describe('validateTemplateBody', () => {
    it('requires payment_reminder to include paymentLink or amount', () => {
      const missingBoth = smsTemplateService.validateTemplateBody(
        'payment_reminder',
        'Reminder for {invoiceNumber} from {customerName}'
      );
      expect(missingBoth.valid).toBe(false);
      expect(missingBoth.errors.some((e) => e.includes('paymentLink'))).toBe(true);

      const withLink = smsTemplateService.validateTemplateBody(
        'payment_reminder',
        'Pay {paymentLink} for invoice {invoiceNumber}'
      );
      expect(withLink.valid).toBe(true);
    });

    it('rejects unknown placeholders', () => {
      const result = smsTemplateService.validateTemplateBody(
        'invoice_sent',
        'Hi {customerName}, ref {unknownVar} {invoiceNumber} {amount} {paymentLink}'
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('unknownVar'))).toBe(true);
    });
  });

  describe('validateRenderVariables', () => {
    it('flags missing runtime variables', () => {
      const body = 'Invoice {invoiceNumber} for {amount}. Pay {paymentLink}';
      const result = smsTemplateService.validateRenderVariables('invoice_sent', body, {
        invoiceNumber: 'INV-1',
        amount: 'GHS 10',
      });
      expect(result.valid).toBe(false);
      expect(result.missing).toContain('paymentLink');
    });
  });

  describe('getTemplatesForTenant / resetTemplate', () => {
    it('returns defaults when no overrides exist', async () => {
      const templates = await smsTemplateService.getTemplatesForTenant('tenant-1');
      const invoiceSent = templates.find((t) => t.eventKey === 'invoice_sent');
      expect(invoiceSent.isCustom).toBe(false);
      expect(invoiceSent.body).toContain('{customerName}');
      expect(invoiceSent.defaultBody).toBe(invoiceSent.body);
    });

    it('resetTemplate removes tenant override', async () => {
      Setting.findOne.mockResolvedValue({
        value: {
          invoice_sent: { body: 'Custom {invoiceNumber} {amount} {paymentLink}', enabled: true },
        },
      });
      Setting.findOrCreate.mockResolvedValue([
        {
          isNewRecord: false,
          value: {},
          save: jest.fn().mockResolvedValue(undefined),
        },
        false,
      ]);

      const reset = await smsTemplateService.resetTemplate('tenant-1', 'invoice_sent');
      expect(reset.isCustom).toBe(false);
      expect(Setting.findOrCreate).toHaveBeenCalled();
    });
  });

  describe('saveTemplate', () => {
    it('persists valid custom body', async () => {
      Setting.findOne.mockImplementation(async () => ({
        value: {
          invoice_sent: {
            body: 'Hi {customerName}, pay {paymentLink} for {invoiceNumber} ({amount})',
            enabled: true,
          },
        },
      }));

      const saved = await smsTemplateService.saveTemplate(
        'tenant-1',
        'invoice_sent',
        'Hi {customerName}, pay {paymentLink} for {invoiceNumber} ({amount})'
      );
      expect(saved.isCustom).toBe(true);
      expect(Setting.findOrCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'tenant-1', key: 'sms_templates' },
        })
      );
    });

    it('rejects invalid template body', async () => {
      await expect(
        smsTemplateService.saveTemplate('tenant-1', 'invoice_sent', 'Missing required placeholders')
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });
});
