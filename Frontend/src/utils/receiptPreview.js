/**
 * Helpers for sale/invoice receipt preview modals.
 */

/**
 * @param {object} response - API response from sale or invoice fetch
 * @returns {object}
 */
export function normalizeEntityResponse(response) {
  return response?.data?.data ?? response?.data ?? response;
}

/**
 * @param {object} sale
 * @param {object|null} customer - Full customer from drawer context
 * @returns {object}
 */
export function enrichSaleCustomer(sale, customer) {
  if (!sale || !customer) return sale;
  const existing = sale.customer;
  if (existing?.name && (existing?.phone || existing?.email)) {
    return sale;
  }
  return {
    ...sale,
    customer: {
      ...existing,
      ...customer,
      id: customer.id ?? existing?.id,
    },
  };
}

/**
 * True when the sale has line items suitable for PrintableReceipt.
 * @param {object} sale
 * @returns {boolean}
 */
export function saleHasLineItems(sale) {
  const items = Array.isArray(sale?.items) ? sale.items : [];
  return items.length > 0;
}

/**
 * True when linked invoice has enough data for PrintableInvoice (not a list stub).
 * @param {object} sale
 * @returns {boolean}
 */
export function shouldUsePrintableInvoice(sale) {
  if (saleHasLineItems(sale)) return false;
  const inv = sale?.invoice;
  if (!inv) return false;
  const items = Array.isArray(inv.items) ? inv.items : [];
  if (items.length > 0) return true;
  const total = parseFloat(inv.totalAmount ?? inv.total ?? 0);
  return Boolean(inv.invoiceNumber || inv.id) && total > 0;
}
