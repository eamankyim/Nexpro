jest.mock('../../../models', () => ({
  Invoice: {
    findOne: jest.fn(),
  },
  Payment: {
    findOne: jest.fn(),
  },
  Sale: {
    count: jest.fn(),
    create: jest.fn(),
    findOne: jest.fn(),
  },
  SaleItem: {
    bulkCreate: jest.fn(),
  },
  SaleActivity: {
    create: jest.fn(),
  },
}));

const { Invoice, Payment, Sale, SaleItem, SaleActivity } = require('../../../models');
const { ensureSaleFromPaidInvoice } = require('../../../services/invoiceSaleService');

const buildInvoice = (overrides = {}) => ({
  id: 'invoice-1',
  tenantId: 'tenant-1',
  invoiceNumber: 'INV-001',
  customerId: 'customer-1',
  quoteId: 'quote-1',
  saleId: null,
  shopId: 'shop-1',
  subtotal: 100,
  taxAmount: 0,
  discountAmount: 0,
  totalAmount: 100,
  amountPaid: 40,
  status: 'partial',
  items: [
    {
      description: 'Quoted product',
      quantity: 2,
      unitPrice: 50,
      total: 100,
      productId: 'product-1',
    },
  ],
  update: jest.fn(async function update(payload) {
    Object.assign(this, payload);
    return this;
  }),
  ...overrides,
});

describe('invoiceSaleService.ensureSaleFromPaidInvoice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Payment.findOne.mockResolvedValue({ id: 'payment-1', paymentMethod: 'mobile_money' });
    Sale.count.mockResolvedValue(3);
    Sale.findOne.mockResolvedValue(null);
    Sale.create.mockImplementation((payload) => Promise.resolve({
      id: 'sale-1',
      ...payload,
      update: jest.fn(async function update(updatePayload) {
        Object.assign(this, updatePayload);
        return this;
      }),
    }));
    SaleItem.bulkCreate.mockResolvedValue([]);
    SaleActivity.create.mockResolvedValue({});
  });

  it('creates a partially paid sale from an invoice once money is recorded', async () => {
    const invoice = buildInvoice();
    Invoice.findOne.mockResolvedValue(invoice);

    const result = await ensureSaleFromPaidInvoice('invoice-1', 'payment-1', {
      tenantId: 'tenant-1',
      userId: 'user-1',
    });

    expect(result.created).toBe(true);
    expect(Sale.create).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      shopId: 'shop-1',
      customerId: 'customer-1',
      invoiceId: 'invoice-1',
      paymentMethod: 'mobile_money',
      amountPaid: 40,
      total: 100,
      status: 'partially_paid',
      metadata: expect.objectContaining({
        invoiceId: 'invoice-1',
        quoteId: 'quote-1',
        inventoryStockAdjusted: false,
      }),
    }), { transaction: null });
    expect(SaleItem.bulkCreate).toHaveBeenCalledWith([
      expect.objectContaining({
        saleId: 'sale-1',
        productId: 'product-1',
        name: 'Quoted product',
        quantity: 2,
        unitPrice: 50,
        total: 100,
      }),
    ], { transaction: null });
    expect(invoice.update).toHaveBeenCalledWith({ saleId: 'sale-1' }, { transaction: null });
    expect(SaleActivity.create).toHaveBeenCalledWith(expect.objectContaining({
      saleId: 'sale-1',
      subject: 'Sale Created from Invoice Payment',
    }), { transaction: null });
  });

  it('updates the existing invoice sale instead of creating a duplicate', async () => {
    const invoice = buildInvoice({
      saleId: 'sale-1',
      amountPaid: 100,
      status: 'paid',
    });
    const existingSale = {
      id: 'sale-1',
      tenantId: 'tenant-1',
      metadata: { existing: true },
      update: jest.fn().mockResolvedValue(undefined),
    };
    Invoice.findOne.mockResolvedValue(invoice);
    Sale.findOne.mockResolvedValue(existingSale);

    const result = await ensureSaleFromPaidInvoice('invoice-1', 'payment-1', {
      tenantId: 'tenant-1',
      paymentMethod: 'cash',
    });

    expect(result.updated).toBe(true);
    expect(Sale.create).not.toHaveBeenCalled();
    expect(SaleItem.bulkCreate).not.toHaveBeenCalled();
    expect(existingSale.update).toHaveBeenCalledWith(expect.objectContaining({
      invoiceId: 'invoice-1',
      amountPaid: 100,
      status: 'completed',
      paymentMethod: 'cash',
      metadata: expect.objectContaining({
        existing: true,
        invoiceId: 'invoice-1',
        lastPaymentId: 'payment-1',
      }),
    }), { transaction: null });
  });

  it('does not create a sale before any payment is recorded', async () => {
    Invoice.findOne.mockResolvedValue(buildInvoice({ amountPaid: 0, status: 'sent' }));

    const result = await ensureSaleFromPaidInvoice('invoice-1', null, { tenantId: 'tenant-1' });

    expect(result.reason).toBe('invoice_not_paid');
    expect(Sale.create).not.toHaveBeenCalled();
    expect(SaleItem.bulkCreate).not.toHaveBeenCalled();
  });
});
