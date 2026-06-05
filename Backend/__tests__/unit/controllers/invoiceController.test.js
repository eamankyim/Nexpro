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
  Payment: { create: jest.fn() },
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
  logInvoicePaid: jest.fn(),
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

const { Invoice, Payment, Setting } = require('../../../models');
const emailService = require('../../../services/emailService');
const { createInvoicePaymentJournal } = require('../../../services/invoiceAccountingService');
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

describe('invoiceController markInvoicePaid payment date', () => {
  let errorSpy;
  let setImmediateSpy;

  const buildRes = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    setImmediateSpy = jest.spyOn(global, 'setImmediate').mockImplementation(() => 1);
  });

  afterEach(() => {
    errorSpy.mockRestore();
    setImmediateSpy.mockRestore();
  });

  it('persists the selected payment date on invoice, payment, and journal records', async () => {
    const invoice = {
      id: 'invoice-1',
      tenantId: 'tenant-1',
      invoiceNumber: 'INV-001',
      customerId: 'customer-1',
      jobId: 'job-1',
      totalAmount: 250,
      amountPaid: 50,
      status: 'sent',
      update: jest.fn().mockResolvedValue(undefined),
    };
    const updatedInvoice = {
      ...invoice,
      amountPaid: 250,
      balance: 0,
      status: 'paid',
      paidDate: new Date('2026-05-15T00:00:00.000Z'),
      toJSON() {
        return {
          id: this.id,
          tenantId: this.tenantId,
          invoiceNumber: this.invoiceNumber,
          customerId: this.customerId,
          jobId: this.jobId,
          amountPaid: this.amountPaid,
          balance: this.balance,
          status: this.status,
          paidDate: this.paidDate,
        };
      },
    };

    Invoice.findOne
      .mockResolvedValueOnce(invoice)
      .mockResolvedValueOnce(updatedInvoice);
    Payment.create.mockResolvedValue({ id: 'payment-1', paymentNumber: 'PAY-1' });

    const req = {
      params: { id: 'invoice-1' },
      body: { paymentDate: '2026-05-15' },
      tenantId: 'tenant-1',
      user: { id: 'user-1' },
    };
    const res = buildRes();
    const next = jest.fn();

    await invoiceController.markInvoicePaid(req, res, next);

    const expectedDate = new Date('2026-05-15');
    expect(invoice.update).toHaveBeenCalledWith(expect.objectContaining({
      amountPaid: 250,
      balance: 0,
      status: 'paid',
      paidDate: expectedDate,
    }));
    expect(Payment.create).toHaveBeenCalledWith(expect.objectContaining({
      amount: 200,
      paymentDate: expectedDate,
    }));
    expect(createInvoicePaymentJournal).toHaveBeenCalledWith(expect.objectContaining({
      amount: 200,
      paymentDate: expectedDate,
    }));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({
        id: 'invoice-1',
        paidDate: expectedDate,
      }),
    }));
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects invalid payment dates before marking an invoice paid', async () => {
    const req = {
      params: { id: 'invoice-1' },
      body: { paymentDate: 'not-a-date' },
      tenantId: 'tenant-1',
      user: { id: 'user-1' },
    };
    const res = buildRes();
    const next = jest.fn();

    await invoiceController.markInvoicePaid(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Payment date is invalid',
    });
    expect(Invoice.findOne).not.toHaveBeenCalled();
    expect(Payment.create).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});
