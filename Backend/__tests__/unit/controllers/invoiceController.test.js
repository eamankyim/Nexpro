jest.mock('../../../config/database', () => ({
  sequelize: {
    transaction: jest.fn(),
  },
}));

jest.mock('../../../models', () => ({
  Invoice: { findOne: jest.fn(), findAndCountAll: jest.fn(), destroy: jest.fn() },
  Job: { findAll: jest.fn().mockResolvedValue([]) },
  Sale: { findAll: jest.fn().mockResolvedValue([]) },
  Customer: {},
  JobItem: {},
  Payment: { create: jest.fn(), findOne: jest.fn(), findAll: jest.fn().mockResolvedValue([]) },
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
  logPaymentReceived: jest.fn(),
}));

jest.mock('../../../services/customerBalanceService', () => ({
  updateCustomerBalance: jest.fn(),
}));

jest.mock('../../../services/invoiceSaleService', () => ({
  ensureSaleFromPaidInvoice: jest.fn().mockResolvedValue({ sale: null, created: false, updated: false }),
}));

jest.mock('../../../services/sabitoWebhookService', () => ({
  sendInvoiceWebhook: jest.fn(),
  sendInvoicePaidWebhook: jest.fn(),
}));

jest.mock('../../../services/mobileMoneyService', () => ({}));
jest.mock('../../../services/tenantMomoCollectionService', () => ({
  getResolvedMtnConfigForTenant: jest.fn(),
}));

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

const { Invoice, Payment, Setting, Job, Sale } = require('../../../models');
const { Op } = require('sequelize');
const { updateCustomerBalance } = require('../../../services/customerBalanceService');
const { ensureSaleFromPaidInvoice } = require('../../../services/invoiceSaleService');
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

describe('invoiceController recordPayment notes', () => {
  const buildRes = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    updateCustomerBalance.mockResolvedValue(undefined);
  });

  it('persists optional notes on the created payment and returns the payment payload', async () => {
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
      amountPaid: 125,
      balance: 125,
      toJSON() {
        return {
          id: this.id,
          tenantId: this.tenantId,
          invoiceNumber: this.invoiceNumber,
          amountPaid: this.amountPaid,
          balance: this.balance,
        };
      },
    };
    const payment = {
      id: 'payment-1',
      paymentNumber: 'PAY-1',
      notes: 'Customer paid at front desk',
      toJSON() {
        return {
          id: this.id,
          paymentNumber: this.paymentNumber,
          notes: this.notes,
        };
      },
    };

    Invoice.findOne
      .mockResolvedValueOnce(invoice)
      .mockResolvedValueOnce(updatedInvoice);
    Payment.create.mockResolvedValue(payment);

    const req = {
      params: { id: 'invoice-1' },
      body: {
        amount: 75,
        paymentMethod: 'cash',
        paymentDate: '2026-05-15',
        notes: 'Customer paid at front desk',
      },
      tenantId: 'tenant-1',
      user: { id: 'user-1' },
    };
    const res = buildRes();
    const next = jest.fn();

    await invoiceController.recordPayment(req, res, next);

    expect(Payment.create).toHaveBeenCalledWith(expect.objectContaining({
      amount: 75,
      notes: 'Customer paid at front desk',
      description: 'invoice:invoice-1',
    }));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({ id: 'invoice-1' }),
      payment: expect.objectContaining({
        id: 'payment-1',
        notes: 'Customer paid at front desk',
      }),
    }));
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts comment alias and stores null when no user note is provided', async () => {
    const invoice = {
      id: 'invoice-1',
      tenantId: 'tenant-1',
      invoiceNumber: 'INV-001',
      customerId: 'customer-1',
      jobId: null,
      totalAmount: 100,
      amountPaid: 0,
      status: 'sent',
      update: jest.fn().mockResolvedValue(undefined),
    };
    const updatedInvoice = {
      ...invoice,
      amountPaid: 50,
      balance: 50,
      toJSON() {
        return { id: this.id, tenantId: this.tenantId, invoiceNumber: this.invoiceNumber };
      },
    };

    Invoice.findOne
      .mockResolvedValueOnce(invoice)
      .mockResolvedValueOnce(updatedInvoice);
    Payment.create.mockResolvedValue({ id: 'payment-2', paymentNumber: 'PAY-2', notes: 'MoMo ref 123' });

    const req = {
      params: { id: 'invoice-1' },
      body: {
        amount: 50,
        paymentMethod: 'cash',
        paymentDate: '2026-05-15',
        comment: 'MoMo ref 123',
      },
      tenantId: 'tenant-1',
      user: { id: 'user-1' },
    };
    const res = buildRes();
    const next = jest.fn();

    await invoiceController.recordPayment(req, res, next);

    expect(Payment.create).toHaveBeenCalledWith(expect.objectContaining({
      notes: 'MoMo ref 123',
    }));
    expect(next).not.toHaveBeenCalled();
  });

  it('stores null notes when payment comment fields are omitted', async () => {
    const invoice = {
      id: 'invoice-1',
      tenantId: 'tenant-1',
      invoiceNumber: 'INV-001',
      customerId: 'customer-1',
      jobId: null,
      totalAmount: 100,
      amountPaid: 0,
      status: 'sent',
      update: jest.fn().mockResolvedValue(undefined),
    };
    const updatedInvoice = {
      ...invoice,
      amountPaid: 25,
      balance: 75,
      toJSON() {
        return { id: this.id, tenantId: this.tenantId, invoiceNumber: this.invoiceNumber };
      },
    };

    Invoice.findOne
      .mockResolvedValueOnce(invoice)
      .mockResolvedValueOnce(updatedInvoice);
    Payment.create.mockResolvedValue({ id: 'payment-3', paymentNumber: 'PAY-3', notes: null });

    const req = {
      params: { id: 'invoice-1' },
      body: {
        amount: 25,
        paymentMethod: 'cash',
        paymentDate: '2026-05-15',
      },
      tenantId: 'tenant-1',
      user: { id: 'user-1' },
    };
    const res = buildRes();
    const next = jest.fn();

    await invoiceController.recordPayment(req, res, next);

    expect(Payment.create).toHaveBeenCalledWith(expect.objectContaining({
      notes: null,
    }));
    expect(next).not.toHaveBeenCalled();
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
    setImmediateSpy = jest.spyOn(global, 'setImmediate').mockImplementation((callback) => {
      if (typeof callback === 'function') callback();
      return 1;
    });
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
      body: { paymentDate: '2026-05-15', notes: 'Paid by bank transfer' },
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
      notes: 'Paid by bank transfer',
    }));
    expect(ensureSaleFromPaidInvoice).toHaveBeenCalledWith('invoice-1', 'payment-1', expect.objectContaining({
      tenantId: 'tenant-1',
      userId: 'user-1',
      paymentMethod: 'other',
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

describe('invoiceController cancelled invoice access', () => {
  const buildRes = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    Job.findAll.mockResolvedValue([]);
    Sale.findAll.mockResolvedValue([]);
    updateCustomerBalance.mockResolvedValue(undefined);
  });

  it('getInvoice returns a cancelled invoice visible in list scope', async () => {
    const cancelledInvoice = {
      id: 'inv-cancelled',
      tenantId: 'tenant-1',
      status: 'cancelled',
      jobId: null,
      saleId: 'sale-1',
      prescriptionId: null,
      shopId: null,
      job: null,
      sale: { soldBy: 'user-1' },
      shop: null,
      studioLocation: null,
      customer: { id: 'customer-1', name: 'Alex' },
      toJSON() {
        return { id: this.id, status: this.status };
      },
    };

    Invoice.findOne.mockResolvedValue(cancelledInvoice);

    const req = {
      params: { id: 'inv-cancelled' },
      tenantId: 'tenant-1',
      tenant: { businessType: 'shop' },
      shopScoped: true,
      shopFilterId: 'shop-a',
      user: { id: 'user-1', role: 'admin' },
      tenantRole: 'admin',
    };
    const res = buildRes();
    const next = jest.fn();

    await invoiceController.getInvoice(req, res, next);

    expect(Invoice.findOne).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({ id: 'inv-cancelled' }),
    }));
    expect(next).not.toHaveBeenCalled();
  });

  it('lets shop-scoped staff view sale-linked invoices from the same shop', async () => {
    const invoice = {
      id: 'inv-sale',
      tenantId: 'tenant-1',
      status: 'sent',
      jobId: null,
      saleId: 'sale-1',
      prescriptionId: null,
      shopId: 'shop-a',
      job: null,
      sale: { soldBy: 'other-staff' },
      shop: null,
      studioLocation: null,
      customer: { id: 'customer-1', name: 'Alex' },
      toJSON() {
        return { id: this.id, saleId: this.saleId, shopId: this.shopId };
      },
    };

    Invoice.findOne.mockResolvedValue(invoice);

    const req = {
      params: { id: 'inv-sale' },
      tenantId: 'tenant-1',
      tenant: { businessType: 'shop' },
      shopScoped: true,
      shopFilterId: 'shop-a',
      user: { id: 'staff-1', role: 'admin' },
      tenantRole: 'staff',
    };
    const res = buildRes();
    const next = jest.fn();

    await invoiceController.getInvoice(req, res, next);

    expect(Sale.findAll).not.toHaveBeenCalled();
    expect(Job.findAll).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenantId: 'tenant-1', createdBy: 'staff-1' }),
    }));
    expect(Invoice.findOne).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'inv-sale',
        tenantId: 'tenant-1',
        [Op.and]: expect.arrayContaining([
          { [Op.or]: expect.arrayContaining([{ saleId: { [Op.ne]: null } }]) },
        ]),
      }),
    }));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  it('deleteCancelledInvoice removes a cancelled invoice with no payments', async () => {
    const cancelledInvoice = {
      id: 'inv-cancelled',
      tenantId: 'tenant-1',
      status: 'cancelled',
      amountPaid: 0,
      balance: 120,
      customerId: 'customer-1',
      shopId: null,
      destroy: jest.fn().mockResolvedValue(undefined),
    };

    Invoice.findOne.mockResolvedValue(cancelledInvoice);

    const req = {
      params: { id: 'inv-cancelled' },
      tenantId: 'tenant-1',
      shopScoped: true,
      shopFilterId: 'shop-a',
      user: { id: 'user-1', role: 'admin' },
      tenantRole: 'admin',
    };
    const res = buildRes();
    const next = jest.fn();

    await invoiceController.deleteCancelledInvoice(req, res, next);

    expect(cancelledInvoice.destroy).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('invoiceController getInvoices list visibility', () => {
  const buildRes = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    Job.findAll.mockResolvedValue([]);
    Sale.findAll.mockResolvedValue([]);
    Invoice.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });
  });

  it('applies shop read filter and sale sourceType for shop tenants', async () => {
    const req = {
      query: { page: '1', limit: '20', shopId: 'shop-a' },
      headers: {},
      tenantId: 'tenant-1',
      tenant: { businessType: 'shop' },
      shopScoped: true,
      shopFilterId: 'shop-a',
      user: { id: 'user-1', role: 'admin' },
      tenantRole: 'admin',
    };
    const res = buildRes();
    const next = jest.fn();

    await invoiceController.getInvoices(req, res, next);

    expect(Invoice.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          [Op.and]: expect.arrayContaining([
            { [Op.or]: [{ sourceType: 'sale' }, { sourceType: 'quote' }] },
            { [Op.or]: [{ shopId: 'shop-a' }, { shopId: null }] },
          ]),
        }),
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });
});
