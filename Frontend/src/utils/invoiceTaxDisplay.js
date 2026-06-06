const roundCurrency = (value) => Math.round((parseFloat(value) || 0) * 100) / 100;

const getOrganizationTax = (invoice, organization) => (
  organization?.tax || invoice?.organization?.tax || {}
);

/**
 * Normalize invoice totals for tax display, including legacy inclusive-tax invoices
 * whose stored taxAmount is zero.
 */
export function getInvoiceTaxDisplay(invoice, organization) {
  const tax = getOrganizationTax(invoice, organization);
  const taxRate = parseFloat(invoice?.taxRate || 0) || 0;
  const storedTaxAmount = roundCurrency(invoice?.taxAmount || 0);
  const totalAmount = roundCurrency(invoice?.totalAmount || 0);
  const storedSubtotal = roundCurrency(invoice?.subtotal || 0);
  const storedDiscountAmount = roundCurrency(invoice?.discountAmount || 0);
  const isTaxInclusive = tax?.pricesAreTaxInclusive === true;
  const displayLabel = tax?.displayLabel || 'Tax';

  if (!isTaxInclusive || taxRate <= 0 || storedTaxAmount > 0 || totalAmount <= 0) {
    return {
      subtotal: storedSubtotal,
      discountAmount: storedDiscountAmount,
      taxAmount: storedTaxAmount,
      taxLabel: isTaxInclusive ? `${displayLabel} included` : displayLabel,
      isTaxInclusive,
      hasTax: storedTaxAmount > 0
    };
  }

  const netTaxable = roundCurrency(totalAmount / (1 + taxRate / 100));
  const includedTaxAmount = roundCurrency(totalAmount - netTaxable);
  const discountAmount = roundCurrency(storedDiscountAmount / (1 + taxRate / 100));
  const subtotal = storedSubtotal > 0
    ? roundCurrency(storedSubtotal / (1 + taxRate / 100))
    : roundCurrency(netTaxable + discountAmount);

  return {
    subtotal,
    discountAmount,
    taxAmount: includedTaxAmount,
    taxLabel: `${displayLabel} included`,
    isTaxInclusive,
    hasTax: includedTaxAmount > 0
  };
}
