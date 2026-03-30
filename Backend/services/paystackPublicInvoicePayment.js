/**
 * Apply a verified Paystack transaction to a workspace invoice (public pay-invoice link).
 * Shared by Paystack webhooks and POST /api/public/invoices/:token/verify-paystack (return URL fallback).
 */

const { Invoice, Customer, Payment, Sale, SaleActivity } = require('../models');
const activityLogger = require('./activityLogger');
const { updateCustomerBalance } = require('./customerBalanceService');

/**
 * @param {Record<string, unknown>} metadata
 * @returns {{ paymentToken?: string, invoiceId?: string, tenantId?: string }}
 */
function getPaystackInvoiceLinkMetadata(metadata) {
  const m = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {};
  return {
    paymentToken: m.paymentToken ?? m.payment_token,
    invoiceId: m.invoiceId ?? m.invoice_id,
    tenantId: m.tenantId ?? m.tenant_id
  };
}

/**
 * Matches initialize-paystack reference: INV-{invoiceUuid}-{timestamp}
 * @param {string} reference
 * @returns {string|null} invoice UUID
 */
function parseInvoiceIdFromPublicPaystackReference(reference) {
  if (!reference || typeof reference !== 'string') return null;
  const re = /^INV-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-\d+/i;
  const match = reference.match(re);
  return match ? match[1] : null;
}

/**
 * @param {string} reference - Paystack transaction reference
 * @param {object} tx - Paystack verify API `data` object
 * @returns {Promise<{ applied: boolean, duplicate?: boolean, reason?: string }>}
 */
async function applyPaystackChargeToInvoiceFromTx(reference, tx) {
  const metadata =
    typeof tx.metadata === 'string' ? JSON.parse(tx.metadata || '{}') : (tx.metadata || {});
  const invLink = getPaystackInvoiceLinkMetadata(metadata);
  const refInvoiceId = parseInvoiceIdFromPublicPaystackReference(reference);

  const isInvoiceCharge =
    String(metadata.type || '').toLowerCase() === 'invoice' ||
    invLink.paymentToken ||
    (invLink.invoiceId && invLink.tenantId) ||
    refInvoiceId;

  if (!isInvoiceCharge) {
    return { applied: false, reason: 'not_invoice_charge' };
  }

  let invoice = null;
  if (invLink.paymentToken) {
    invoice = await Invoice.findOne({
      where: { paymentToken: invLink.paymentToken },
      include: [{ model: Customer, as: 'customer' }]
    });
  }
  if (!invoice && invLink.invoiceId && invLink.tenantId) {
    invoice = await Invoice.findOne({
      where: { id: invLink.invoiceId, tenantId: invLink.tenantId },
      include: [{ model: Customer, as: 'customer' }]
    });
  }
  if (!invoice && refInvoiceId) {
    invoice = await Invoice.findByPk(refInvoiceId, {
      include: [{ model: Customer, as: 'customer' }]
    });
    if (invoice && invLink.tenantId && String(invoice.tenantId) !== String(invLink.tenantId)) {
      invoice = null;
    }
  }

  if (!invoice) {
    console.error(
      '[PaystackInvoice] Invoice not found for payment – paymentToken:',
      invLink.paymentToken,
      'invoiceId:',
      invLink.invoiceId,
      'refInvoiceId:',
      refInvoiceId
    );
    return { applied: false, reason: 'invoice_not_found' };
  }

  if (invoice.status === 'cancelled' || invoice.status === 'paid') {
    return { applied: false, reason: 'invoice_terminal_state', invoiceId: invoice.id };
  }

  const existingPayment = await Payment.findOne({
    where: { referenceNumber: reference, tenantId: invoice.tenantId }
  });
  if (existingPayment) {
    console.log('[PaystackInvoice] Payment already recorded for reference:', reference);
    return { applied: false, duplicate: true, invoiceId: invoice.id };
  }

  const paymentAmount = parseFloat(tx.amount || 0) / 100;
  const totalAmount = parseFloat(invoice.totalAmount || 0);
  const currentPaid = parseFloat(invoice.amountPaid || 0);
  const remaining = Math.max(totalAmount - currentPaid, 0);
  const appliedPaymentAmount = Math.min(paymentAmount, remaining);
  const newAmountPaid = currentPaid + appliedPaymentAmount;
  const newBalance = Math.max(totalAmount - newAmountPaid, 0);

  const updatePayload = {
    amountPaid: newAmountPaid,
    balance: newBalance
  };
  if (newBalance <= 0) {
    updatePayload.status = 'paid';
    updatePayload.paidDate = new Date();
  } else if (invoice.status === 'draft') {
    updatePayload.status = 'sent';
  } else if (invoice.status === 'sent' && newAmountPaid > 0) {
    updatePayload.status = 'partial';
  }
  await invoice.update(updatePayload);

  const paymentNumber = `PAY-${Date.now()}`;
  const paymentData = {
    paymentNumber,
    type: 'income',
    customerId: invoice.customerId,
    tenantId: invoice.tenantId,
    amount: appliedPaymentAmount,
    paymentMethod: 'credit_card',
    paymentDate: new Date(),
    referenceNumber: reference,
    status: 'completed',
    notes: `Paystack payment for invoice ${invoice.invoiceNumber}`
  };
  if (invoice.jobId) paymentData.jobId = invoice.jobId;
  if (invoice.saleId) paymentData.saleId = invoice.saleId;
  if (invoice.prescriptionId) paymentData.prescriptionId = invoice.prescriptionId;
  await Payment.create(paymentData);

  if (invoice.saleId && newAmountPaid >= totalAmount) {
    const sale = await Sale.findByPk(invoice.saleId);
    if (sale && sale.status === 'pending') {
      await sale.update({ status: 'completed' });
      await SaleActivity.create({
        saleId: sale.id,
        tenantId: invoice.tenantId,
        type: 'payment',
        subject: 'Payment Received',
        notes: `Paystack payment for invoice ${invoice.invoiceNumber}`,
        createdBy: null,
        metadata: {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          paymentAmount: appliedPaymentAmount,
          paystackRef: reference
        }
      });
    }
  }

  try {
    await activityLogger.logInvoicePaid(invoice, null);
  } catch (e) {
    console.error('[PaystackInvoice] activityLogger error:', e.message);
  }

  const tenantId = invoice.tenantId;
  const invoiceSnapshot = invoice;
  setImmediate(() => {
    try {
      const { sendInvoicePaidConfirmationToCustomer } = require('../controllers/invoiceController');
      sendInvoicePaidConfirmationToCustomer(tenantId, invoiceSnapshot);
    } catch (e) {
      console.error('[PaystackInvoice] sendInvoicePaidConfirmation:', e.message);
    }
  });

  try {
    if (invoice.customerId) await updateCustomerBalance(invoice.customerId);
  } catch (e) {
    console.error('[PaystackInvoice] updateCustomerBalance error:', e.message);
  }

  console.log(
    '[PaystackInvoice] Invoice payment applied:',
    invoice.invoiceNumber,
    'reference:',
    reference
  );
  return { applied: true, invoiceId: invoice.id };
}

module.exports = {
  applyPaystackChargeToInvoiceFromTx,
  getPaystackInvoiceLinkMetadata,
  parseInvoiceIdFromPublicPaystackReference
};
