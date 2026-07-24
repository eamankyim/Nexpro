jest.mock('../../../models', () => ({
  Sale: {},
  SaleItem: {
    findAll: jest.fn(),
    destroy: jest.fn(),
  },
  SaleActivity: {
    destroy: jest.fn(),
  },
  SaleReturn: {
    count: jest.fn(),
  },
  Invoice: {
    findAll: jest.fn(),
  },
  Payment: {
    destroy: jest.fn(),
  },
  Product: {
    findByPk: jest.fn(),
  },
  ProductVariant: {
    findByPk: jest.fn(),
  },
}));

jest.mock('../../../services/accountingService', () => ({
  reverseAndDestroyJournalEntries: jest.fn().mockResolvedValue(0),
}));

jest.mock('../../../services/dealerLedgerService', () => ({
  reverseAndDestroyLedgerEntriesForSale: jest.fn().mockResolvedValue(0),
}));

jest.mock('../../../services/customerBalanceService', () => ({
  updateCustomerBalance: jest.fn().mockResolvedValue(undefined),
}));

const {
  SaleItem,
  SaleActivity,
  SaleReturn,
  Invoice,
  Payment,
} = require('../../../models');
const { reverseAndDestroyJournalEntries } = require('../../../services/accountingService');
const { reverseAndDestroyLedgerEntriesForSale } = require('../../../services/dealerLedgerService');
const { updateCustomerBalance } = require('../../../services/customerBalanceService');
const {
  hardDeleteSaleInTransaction,
  buildSaleLinkedPaymentOr,
} = require('../../../services/saleHardDeleteService');

describe('saleHardDeleteService', () => {
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };

  beforeEach(() => {
    jest.clearAllMocks();
    SaleReturn.count.mockResolvedValue(0);
    Invoice.findAll.mockResolvedValue([]);
    Payment.destroy.mockResolvedValue(0);
    SaleItem.destroy.mockResolvedValue(0);
    SaleActivity.destroy.mockResolvedValue(0);
    reverseAndDestroyJournalEntries.mockResolvedValue(0);
    reverseAndDestroyLedgerEntriesForSale.mockResolvedValue(0);
    updateCustomerBalance.mockResolvedValue(undefined);
  });

  const buildSale = (overrides = {}) => ({
    id: 'sale-1',
    tenantId: 'tenant-1',
    status: 'completed',
    customerId: null,
    invoiceId: null,
    items: [],
    update: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  });

  it('matches sale and invoice payment description patterns', () => {
    const or = buildSaleLinkedPaymentOr('sale-1', ['inv-1']);
    expect(or.some((clause) => clause.description === 'sale:sale-1')).toBe(true);
    expect(or.some((clause) => clause.description === 'invoice:inv-1')).toBe(true);
    expect(or.length).toBeGreaterThanOrEqual(4);
  });

  it('hard-deletes a paid credit sale: payments, journals, invoice, customer balance', async () => {
    const invoice = {
      id: 'inv-1',
      status: 'paid',
      saleId: 'sale-1',
      customerId: 'cust-1',
      update: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn().mockResolvedValue(undefined),
    };
    const sale = buildSale({
      invoiceId: 'inv-1',
      customerId: 'cust-1',
      amountPaid: 500,
      paymentMethod: 'credit',
    });
    Invoice.findAll.mockResolvedValue([invoice]);

    const result = await hardDeleteSaleInTransaction({
      sale,
      tenantId: 'tenant-1',
      transaction,
    });

    expect(Payment.destroy).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenantId: 'tenant-1' }),
      transaction,
    }));
    expect(reverseAndDestroyJournalEntries).toHaveBeenCalledWith(expect.objectContaining({
      sources: expect.arrayContaining([
        { source: 'sale_revenue', sourceId: 'sale-1' },
        { source: 'invoice_revenue', sourceId: 'inv-1' },
        { source: 'invoice_payment', sourceId: 'inv-1' },
      ]),
    }));
    expect(sale.update).toHaveBeenCalledWith({ invoiceId: null }, { transaction });
    expect(invoice.destroy).toHaveBeenCalledWith({ transaction });
    expect(updateCustomerBalance).toHaveBeenCalledWith('cust-1', transaction);
    expect(sale.destroy).toHaveBeenCalledWith({ transaction });
    expect(result.invoiceIds).toEqual(['inv-1']);
  });

  it('hard-deletes a dealer sale and reverses sale-linked ledger charges', async () => {
    const sale = buildSale({
      dealerId: 'dealer-1',
      saleChannel: 'dealer',
      amountPaid: 20,
    });

    await hardDeleteSaleInTransaction({
      sale,
      tenantId: 'tenant-1',
      transaction,
    });

    expect(reverseAndDestroyLedgerEntriesForSale).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      saleId: 'sale-1',
      transaction,
    });
    expect(sale.destroy).toHaveBeenCalled();
  });

  it('blocks hard-delete when the sale has returns or exchanges', async () => {
    SaleReturn.count.mockResolvedValue(2);
    const sale = buildSale();

    await expect(hardDeleteSaleInTransaction({
      sale,
      tenantId: 'tenant-1',
      transaction,
    })).rejects.toMatchObject({
      statusCode: 400,
      errorCode: 'SALE_HAS_RETURNS',
      message: expect.stringContaining('returns'),
    });

    expect(sale.destroy).not.toHaveBeenCalled();
    expect(Payment.destroy).not.toHaveBeenCalled();
  });
});
