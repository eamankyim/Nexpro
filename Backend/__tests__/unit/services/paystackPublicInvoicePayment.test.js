jest.mock('../../../models', () => ({
  Invoice: { findOne: jest.fn(), findByPk: jest.fn() },
  Customer: {},
  Payment: { findOne: jest.fn(), create: jest.fn() },
  Tenant: { findByPk: jest.fn() },
  Sale: { findOne: jest.fn() }
}));

jest.mock('../../../services/activityLogger', () => ({
  logInvoicePaid: jest.fn()
}));

jest.mock('../../../services/customerBalanceService', () => ({
  updateCustomerBalance: jest.fn()
}));

jest.mock('../../../services/invoiceSaleService', () => ({
  ensureSaleFromPaidInvoice: jest.fn().mockResolvedValue({ sale: null, created: false, updated: false })
}));

jest.mock('../../../services/paystackService', () => ({
  secretKey: 'sk_test',
  verifyTransaction: jest.fn(),
  listTransactions: jest.fn()
}));

const paystackService = require('../../../services/paystackService');
const { Payment, Invoice } = require('../../../models');
const {
  applyPaystackChargeToInvoiceFromTx,
  rememberPendingInvoicePaystackReference,
  reconcileInvoicePaystackPayment,
  parseInvoiceIdFromPublicPaystackReference
} = require('../../../services/paystackPublicInvoicePayment');

describe('paystackPublicInvoicePayment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('parses invoice id from public Paystack reference', () => {
    const invoiceId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    expect(parseInvoiceIdFromPublicPaystackReference(`INV-${invoiceId}-1710000000`)).toBe(invoiceId);
    expect(parseInvoiceIdFromPublicPaystackReference('SALE-123')).toBeNull();
  });

  it('applies a successful Paystack charge idempotently', async () => {
    const invoiceId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const reference = `INV-${invoiceId}-1710000000`;
    const invoice = {
      id: invoiceId,
      tenantId: 'tenant-1',
      invoiceNumber: 'INV-001',
      totalAmount: 96,
      amountPaid: 0,
      status: 'sent',
      customerId: 'cust-1',
      paymentToken: 'token-1',
      update: jest.fn().mockResolvedValue(undefined)
    };

    Invoice.findOne.mockResolvedValue(invoice);
    Payment.findOne.mockResolvedValue(null);
    Payment.create.mockResolvedValue({ id: 'pay-1' });

    const tx = {
      status: 'success',
      amount: 9600,
      metadata: {
        type: 'invoice',
        paymentToken: 'token-1',
        invoiceId,
        tenantId: 'tenant-1'
      }
    };

    const first = await applyPaystackChargeToInvoiceFromTx(reference, tx);
    expect(first.applied).toBe(true);
    expect(invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        amountPaid: 96,
        balance: 0,
        status: 'paid'
      })
    );

    Payment.findOne.mockResolvedValue({ id: 'pay-1', paymentMethod: 'credit_card' });
    const second = await applyPaystackChargeToInvoiceFromTx(reference, tx);
    expect(second.duplicate).toBe(true);
    expect(second.applied).toBe(false);
  });

  it('reconciles using remembered pending reference', async () => {
    const invoiceId = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
    const reference = `INV-${invoiceId}-1710000001`;
    const invoice = {
      id: invoiceId,
      tenantId: 'tenant-1',
      paymentToken: 'token-2',
      status: 'sent',
      totalAmount: 50,
      amountPaid: 0,
      update: jest.fn().mockResolvedValue(undefined),
      customerId: 'cust-2',
      invoiceNumber: 'INV-002'
    };

    rememberPendingInvoicePaystackReference(invoiceId, reference);

    paystackService.verifyTransaction.mockResolvedValue({
      status: true,
      data: {
        status: 'success',
        amount: 5000,
        metadata: { type: 'invoice', invoiceId, tenantId: 'tenant-1', paymentToken: 'token-2' }
      }
    });

    Invoice.findOne.mockResolvedValue(invoice);
    Payment.findOne.mockResolvedValue(null);
    Payment.create.mockResolvedValue({ id: 'pay-2' });

    const outcome = await reconcileInvoicePaystackPayment(invoice);
    expect(outcome.applied).toBe(true);
    expect(paystackService.verifyTransaction).toHaveBeenCalledWith(reference);
  });
});
