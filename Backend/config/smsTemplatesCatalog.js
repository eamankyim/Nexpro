/**
 * Default SMS templates per customer-facing event.
 * Tenants may override body text via settings key `sms_templates`.
 */

const SMS_TEMPLATE_VARIABLES = [
  'customerName',
  'businessName',
  'branchName',
  'invoiceNumber',
  'amount',
  'paymentLink',
  'quoteNumber',
  'orderNumber',
  'jobNumber',
  'jobTitle',
  'trackingLink',
  'dueDate',
];

const SMS_TEMPLATES_CATALOG = {
  invoice_sent: {
    key: 'invoice_sent',
    label: 'Invoice sent',
    description: 'SMS when an invoice is sent to a customer.',
    category: 'sales',
    variables: ['customerName', 'businessName', 'branchName', 'invoiceNumber', 'amount', 'paymentLink'],
    requiredVariables: ['invoiceNumber', 'amount', 'paymentLink'],
    defaultBody:
      'Hi {customerName}, invoice {invoiceNumber} for {amount} from {businessName}. Pay here: {paymentLink}',
  },
  invoice_paid: {
    key: 'invoice_paid',
    label: 'Invoice paid',
    description: 'SMS confirmation when an invoice is marked paid.',
    category: 'sales',
    variables: ['customerName', 'businessName', 'branchName', 'invoiceNumber', 'amount'],
    requiredVariables: ['invoiceNumber'],
    defaultBody: 'Invoice {invoiceNumber} paid. Thank you, {customerName}.',
  },
  payment_reminder: {
    key: 'payment_reminder',
    label: 'Payment reminder',
    description: 'SMS for overdue invoice reminders.',
    category: 'sales',
    variables: [
      'customerName',
      'businessName',
      'branchName',
      'invoiceNumber',
      'amount',
      'paymentLink',
      'dueDate',
    ],
    requiredVariables: ['invoiceNumber'],
    requiredAnyOf: [['paymentLink'], ['amount']],
    defaultBody:
      'Reminder: invoice {invoiceNumber} ({amount}) is overdue. Pay: {paymentLink}',
  },
  sales_receipt: {
    key: 'sales_receipt',
    label: 'Sales receipt',
    description: 'Short SMS receipt after a sale.',
    category: 'sales',
    variables: ['customerName', 'businessName', 'branchName', 'orderNumber', 'amount'],
    requiredVariables: ['orderNumber', 'amount'],
    defaultBody: 'Thanks {customerName}! Receipt {orderNumber} from {businessName}: {amount}.',
  },
  quote_sent: {
    key: 'quote_sent',
    label: 'Quote sent',
    description: 'SMS when a quote is sent to a customer.',
    category: 'sales',
    variables: ['customerName', 'businessName', 'branchName', 'quoteNumber', 'paymentLink'],
    requiredVariables: ['quoteNumber', 'paymentLink'],
    defaultBody: 'Hi {customerName}, quote {quoteNumber} from {businessName} is ready. View: {paymentLink}',
  },
  order_created: {
    key: 'order_created',
    label: 'Order created',
    description: 'SMS when a customer order is received.',
    category: 'sales',
    variables: ['customerName', 'businessName', 'branchName', 'orderNumber', 'amount', 'trackingLink'],
    requiredVariables: ['orderNumber', 'amount'],
    defaultBody:
      'Hi {customerName}, we received order {orderNumber} at {businessName}. Total: {amount}. Track your order: {trackingLink}',
  },
  job_tracking_created: {
    key: 'job_tracking_created',
    label: 'Job tracking link',
    description: 'SMS when a job is created with a customer tracking link.',
    category: 'operations',
    variables: ['customerName', 'businessName', 'jobNumber', 'jobTitle', 'trackingLink'],
    requiredVariables: ['trackingLink'],
    defaultBody:
      'Hi {customerName}, {businessName} created job {jobNumber}. Track here: {trackingLink}',
  },
};

const SMS_TEMPLATE_EVENT_KEYS = Object.keys(SMS_TEMPLATES_CATALOG);

const getSmsTemplateDefinition = (eventKey) => SMS_TEMPLATES_CATALOG[eventKey] || null;

const listSmsTemplateDefinitions = () =>
  SMS_TEMPLATE_EVENT_KEYS.map((key) => {
    const def = SMS_TEMPLATES_CATALOG[key];
    return {
      key: def.key,
      label: def.label,
      description: def.description,
      category: def.category,
      variables: [...def.variables],
      requiredVariables: [...(def.requiredVariables || [])],
      requiredAnyOf: def.requiredAnyOf ? def.requiredAnyOf.map((group) => [...group]) : [],
      defaultBody: def.defaultBody,
    };
  });

module.exports = {
  SMS_TEMPLATE_VARIABLES,
  SMS_TEMPLATES_CATALOG,
  SMS_TEMPLATE_EVENT_KEYS,
  getSmsTemplateDefinition,
  listSmsTemplateDefinitions,
};
