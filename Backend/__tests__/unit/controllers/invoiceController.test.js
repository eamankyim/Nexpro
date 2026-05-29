jest.mock('../../../config/database', () => ({
  sequelize: {
    transaction: jest.fn(),
  },
}));

jest.mock('../../../models', () => ({
  Invoice: { findOne: jest.fn() },
  Job: {},
  Customer: {},
  JobItem: {},
  Payment: {},
  Sale: {},
  SaleItem: {},
  Prescription: {},
  SaleActivity: {},
  Tenant: {},
  Setting: { findOne: jest.fn() },
  Quote: {},
  QuoteItem: {},
  Product: {},
  Shop: { findByPk: jest.fn() },
  StudioLocation: { findByPk: jest.fn() },
  User: {},
}));

jest.mock('../../../middleware/cache', () => ({
  invalidateInvoiceListCache: jest.fn(),
  invalidateAfterMutation: jest.fn(),
}));

jest.mock('../../../services/activityLogger', () => ({
  logInvoiceSent: jest.fn(),
}));

jest.mock('../../../services/customerBalanceService', () => ({
  updateCustomerBalance: jest.fn(),
}));

jest.mock('../../../services/sabitoWebhookService', () => ({
  sendInvoiceWebhook: jest.fn(),
  sendInvoicePaidWebhook: jest.fn(),
}));

jest.mock('../../../services/mobileMoneyService', () => ({}));

jest.mock('../../../services/invoiceAccountingService', () => ({
  createInvoicePaymentJournal: jest.fn(),
  createInvoiceRevenueJournal: jest.fn(),
}));

jest.mock('../../../utils/taxConfig', () => ({
  getTaxConfigForTenant: jest.fn().mockResolvedValue({ enabled: false }),
}));

jest.mock('../../../utils/taxCalculation', () => ({
  convertLineItemsFromTaxInclusive: jest.fn(({ items, subtotal }) => ({ items, subtotal })),
}));

jest.mock('../../../utils/tenantLogo', () => ({
  getTenantLogoUrl: jest.fn(),
}));

jest.mock('../../../utils/documentOrganizationUtils', () => ({
  resolveDocumentOrganization: jest.fn().mockResolvedValue({ name: 'Test Business' }),
  organizationToEmailCompany: jest.fn().mockReturnValue({
    name: 'Test Business',
    logo: '',
    primaryColor: '#166534',
  }),
}));

jest.mock('../../../services/whatsappService', () => ({
  getConfig: jest.fn().mockResolvedValue(null),
  validatePhoneNumber: jest.fn((phone) => phone),
  sendMessage: jest.fn(),
}));

jest.mock('../../../services/smsService', () => ({
  getResolvedConfig: jest.fn().mockResolvedValue(null),
  validatePhoneNumber: jest.fn((phone) => phone),
  checkRateLimit: jest.fn().mockReturnValue(true),
  sendMessage: jest.fn(),
}));

jest.mock('../../../services/emailTemplates', () => ({
  invoiceNotification: jest.fn().mockReturnValue({
    subject: 'Invoice INV-001',
    html: '<p>Invoice</p>',
    text: 'Invoice',
  }),
}));

jest.mock('../../../services/emailService', () => ({
  sendMessage: jest.fn(),
}));

const { Invoice, Setting } = require('../../../models');
const emailService = require('../../../services/emailService');
const invoiceController = require('../../../controllers/invoiceController');

describe('invoiceController sendInvoiceToCustomer logging', () => {
  const baseInvoice = () => ({
    id: 'invoice-1',
    tenantId: 'tenant-1',
    invoiceNumber: 'INV-001',
    saleId: 'sale-1',
    sourceType: 'sale',
    customerId: 'customer-1',
    paymentToken: 'token-1',
    totalAmount: 125,
    items: [],
    customer: {
      id: 'customer-1',
      email: 'alex@example.com',
      phone: '+233501234567',
    },
    job: null,
    update: jest.fn().mockResolvedValue(undefined),
    reload: jest.fn().mockResolvedValue(undefined),
    toJSON() {
      return {
        id: this.id,
        invoiceNumber: this.invoiceNumber,
        saleId: this.saleId,
        sourceType: this.sourceType,
        totalAmount: this.totalAmount,
      };
    },
  });

  let logSpy;
  let warnSpy;
  let errorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('logs the setting, sale invoice identifiers, masked email, attempt, and success', async () => {
    const invoice = baseInvoice();
    Invoice.findOne.mockResolvedValue(invoice);
    Setting.findOne.mockResolvedValue({
      value: { autoSendInvoiceToCustomer: true },
    });
    emailService.sendMessage.mockResolvedValue({ success: true, messageId: 'msg-1' });

    await invoiceController.sendInvoiceToCustomer('tenant-1', invoice, {
      userId: 'user-1',
      deliverySource: 'test_sale_invoice',
    });

    expect(emailService.sendMessage).toHaveBeenCalledWith(
      'tenant-1',
      'alex@example.com',
      'Invoice INV-001',
      '<p>Invoice</p>',
      'Invoice'
    );
    expect(logSpy).toHaveBeenCalledWith('[InvoiceDelivery]', expect.objectContaining({
      event: 'invoice_send_decision',
      tenantId: 'tenant-1',
      userId: 'user-1',
      saleId: 'sale-1',
      invoiceId: 'invoice-1',
      sourceType: 'sale',
      autoSendInvoiceToCustomer: true,
      hasCustomerEmail: true,
      customerEmail: 'al***@e***.com',
      decision: 'send_customer_channels',
    }));
    expect(logSpy).toHaveBeenCalledWith('[InvoiceDelivery]', expect.objectContaining({
      event: 'invoice_email_attempt',
      providerPath: 'emailService.sendMessage',
    }));
    expect(logSpy).toHaveBeenCalledWith('[InvoiceDelivery]', expect.objectContaining({
      event: 'invoice_email_success',
      providerPath: 'emailService.sendMessage',
      messageId: 'msg-1',
    }));
  });

  it('logs a skip and does not send email when auto-send is disabled', async () => {
    const invoice = baseInvoice();
    Invoice.findOne.mockResolvedValue(invoice);
    Setting.findOne.mockResolvedValue({
      value: { autoSendInvoiceToCustomer: false },
    });

    await invoiceController.sendInvoiceToCustomer('tenant-1', invoice, {
      deliverySource: 'test_sale_invoice',
    });

    expect(emailService.sendMessage).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith('[InvoiceDelivery]', expect.objectContaining({
      event: 'invoice_send_decision',
      tenantId: 'tenant-1',
      saleId: 'sale-1',
      autoSendInvoiceToCustomer: false,
      autoSendInvoiceToCustomerRaw: false,
      decision: 'skip_customer_channels',
      reason: 'auto_send_disabled',
    }));
    expect(logSpy).toHaveBeenCalledWith('[InvoiceDelivery]', expect.objectContaining({
      event: 'invoice_email_skipped',
      reason: 'auto_send_disabled',
    }));
  });
});
