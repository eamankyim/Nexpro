/**
 * WhatsApp Message Templates
 * Defines template structures for WhatsApp Business API messages
 * Note: Templates must be pre-approved in Meta Business Manager
 */

const TEMPLATES = {
  invoice_notification: {
    name: 'invoice_notification',
    language: 'en',
    description: 'Send invoice with payment link',
    parameters: ['customerName', 'invoiceNumber', 'amount', 'paymentLink'],
    example: 'Hello {{1}}, your invoice {{2}} for {{3}} is ready. Pay online: {{4}}'
  },
  quote_delivery: {
    name: 'quote_delivery',
    language: 'en',
    description: 'Send quote/proposal to customer',
    parameters: ['customerName', 'quoteNumber', 'title', 'quoteLink'],
    example: 'Hi {{1}}, your quote {{2}} for {{3}} is ready. View here: {{4}}'
  },
  order_confirmation: {
    name: 'order_confirmation',
    language: 'en',
    description: 'Confirm order/job creation',
    parameters: ['customerName', 'orderNumber'],
    example: "Thank you {{1}}! Your order {{2}} has been confirmed. We'll notify you when it's ready."
  },
  payment_reminder: {
    name: 'payment_reminder',
    language: 'en',
    description: 'Remind customer about overdue payment',
    parameters: ['invoiceNumber', 'amount', 'paymentLink'],
    example: 'Reminder: Invoice {{1}} for {{2}} is overdue. Please pay: {{3}}'
  },
  low_stock_alert: {
    name: 'low_stock_alert',
    language: 'en',
    description: 'Alert shop owner about low stock',
    parameters: ['productName', 'currentStock', 'reorderLevel'],
    example: 'Alert: {{1}} is running low. Current stock: {{2}}, Reorder level: {{3}}'
  }
};

/**
 * Format currency amount for display
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code (default: GHS)
 * @returns {string} - Formatted amount
 */
function formatCurrency(amount, currency = 'GHS') {
  const numAmount = parseFloat(amount) || 0;
  return `${currency} ${numAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Prepare template parameters for invoice notification
 * @param {Object} invoice - Invoice object
 * @param {Object} customer - Customer object
 * @param {string} paymentLink - Payment link URL
 * @returns {Array} - Template parameters array
 */
function prepareInvoiceNotification(invoice, customer, paymentLink) {
  return [
    customer.name || customer.company || 'Customer',
    invoice.invoiceNumber || 'N/A',
    formatCurrency(invoice.totalAmount || invoice.balance),
    paymentLink
  ];
}

/**
 * Prepare template parameters for quote delivery
 * @param {Object} quote - Quote object
 * @param {Object} customer - Customer object
 * @param {string} quoteLink - Quote link URL
 * @returns {Array} - Template parameters array
 */
function prepareQuoteDelivery(quote, customer, quoteLink) {
  return [
    customer.name || customer.company || 'Customer',
    quote.quoteNumber || 'N/A',
    quote.title || 'Quote',
    quoteLink
  ];
}

/**
 * Prepare template parameters for order confirmation
 * @param {Object} order - Job/Order object
 * @param {Object} customer - Customer object
 * @returns {Array} - Template parameters array
 */
function prepareOrderConfirmation(order, customer) {
  const orderNumber = order.jobNumber || order.saleNumber || order.prescriptionNumber || 'N/A';
  return [
    customer.name || customer.company || 'Customer',
    orderNumber
  ];
}

/**
 * Prepare template parameters for payment reminder
 * @param {Object} invoice - Invoice object
 * @param {string} paymentLink - Payment link URL
 * @returns {Array} - Template parameters array
 */
function preparePaymentReminder(invoice, paymentLink) {
  return [
    invoice.invoiceNumber || 'N/A',
    formatCurrency(invoice.balance || invoice.totalAmount),
    paymentLink
  ];
}

/**
 * Prepare template parameters for low stock alert
 * @param {Object} product - Product object
 * @returns {Array} - Template parameters array
 */
function prepareLowStockAlert(product) {
  return [
    product.name || 'Product',
    String(product.quantity || 0),
    String(product.reorderLevel || 0)
  ];
}

/**
 * Get template definition
 * @param {string} templateName - Template name
 * @returns {Object|null} - Template definition or null
 */
function getTemplate(templateName) {
  return TEMPLATES[templateName] || null;
}

/**
 * Validate template parameters
 * @param {string} templateName - Template name
 * @param {Array} parameters - Parameters to validate
 * @returns {boolean} - True if valid
 */
function validateParameters(templateName, parameters) {
  const template = getTemplate(templateName);
  if (!template) return false;
  
  return parameters.length === template.parameters.length;
}

module.exports = {
  TEMPLATES,
  formatCurrency,
  prepareInvoiceNotification,
  prepareQuoteDelivery,
  prepareOrderConfirmation,
  preparePaymentReminder,
  prepareLowStockAlert,
  getTemplate,
  validateParameters
};
