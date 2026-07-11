/**
 * Structured automation rule builder — maps UI state ↔ API triggerConfig / conditionConfig / actionConfig.
 * Keep in sync with Backend/services/automationEngineService.js action types.
 */

export const TRIGGER_OPTIONS = [
  {
    value: 'invoice_due_in_days',
    label: 'Before an invoice is due',
    hint: 'Fires relative to each invoice’s due date.',
  },
  {
    value: 'invoice_overdue',
    label: 'After an invoice is overdue',
    hint: 'Fires when an invoice is past due.',
  },
  {
    value: 'low_stock_detected',
    label: 'Low stock',
    hint: 'When stock crosses your threshold (e.g. reorder level).',
  },
  {
    value: 'quote_no_response',
    label: 'Quote with no response',
    hint: 'When a quote has had no activity for a set time.',
  },
  {
    value: 'customer_inactive_days',
    label: 'Inactive customer',
    hint: 'When a customer has not been active for a while.',
  },
  {
    value: 'customer_birthday',
    label: 'Customer birthday',
    hint: 'When today matches a customer date of birth.',
  },
  {
    value: 'payment_received',
    label: 'Payment received',
    hint: 'When a payment is recorded on an invoice.',
  },
  {
    value: 'review_request',
    label: 'Review request',
    hint: 'After a job, sale, or standalone invoice is fully paid.',
  },
  {
    value: 'job_completed',
    label: 'Job completed',
    hint: 'When a job or service is marked complete.',
  },
  {
    value: 'daily_sales_summary',
    label: 'Daily sales summary',
    hint: 'Scheduled recap of sales activity for your team.',
  },
  {
    value: 'new_lead',
    label: 'New lead',
    hint: 'When a new lead is created.',
  },
  {
    value: 'high_value_invoice',
    label: 'High value invoice',
    hint: 'When an invoice exceeds a set amount.',
  },
  {
    value: 'customer_created',
    label: 'New customer',
    hint: 'When a new customer is added.',
  },
  {
    value: 'lead_no_contact_days',
    label: 'Lead no contact',
    hint: 'When a lead has had no contact for a set time.',
  },
  {
    value: 'invoice_sent',
    label: 'Invoice sent',
    hint: 'When an invoice is sent to a customer.',
  },
  {
    value: 'sale_completed',
    label: 'Sale completed',
    hint: 'When a sale is completed (receipt / confirmation).',
  },
  {
    value: 'order_created',
    label: 'Order created',
    hint: 'When an order/sale is created for a customer (includes tracking link).',
  },
  {
    value: 'low_stock_on_change',
    label: 'Low stock (real-time)',
    hint: 'When stock drops to reorder level after a sale or adjustment.',
  },
  {
    value: 'out_of_stock_detected',
    label: 'Out of stock (real-time)',
    hint: 'When a product goes out of stock.',
  },
  {
    value: 'quote_sent',
    label: 'Quote sent',
    hint: 'When a quote is sent to a customer.',
  },
  {
    value: 'job_due_in_hours',
    label: 'Job due soon',
    hint: 'Remind the assigned team member when a job is due within a set number of hours.',
  },
  {
    value: 'prescription_refill_due',
    label: 'Prescription refill due',
    hint: 'Pharmacy: when a prescription refill is approaching.',
  },
  {
    value: 'low_profit_margin',
    label: 'Low profit margin',
    hint: 'When a completed sale margin is below threshold.',
  },
];

export const THRESHOLD_MODE_OPTIONS = [
  { value: 'reorder_level', label: 'At or below reorder level' },
  { value: 'fixed', label: 'Below a fixed quantity' },
];

export const ACTION_TYPE_OPTIONS = [
  { value: 'create_task', label: 'Create a task' },
  { value: 'send_email_platform', label: 'Send email (platform)' },
  { value: 'send_sms', label: 'Send SMS' },
  { value: 'send_whatsapp', label: 'Send WhatsApp (template)' },
];

export const MESSAGING_ACTION_TYPES = ['send_sms', 'send_whatsapp', 'send_email_platform'];

/** Placeholders available in trigger context when automations run (see automationEngineService). */
export const TRIGGER_PLACEHOLDERS = {
  invoice_due_in_days: [
    'customerName',
    'businessName',
    'invoiceNumber',
    'balance',
    'amount',
    'totalAmount',
    'dueDate',
    'paymentLink',
    'email',
    'phone',
  ],
  invoice_overdue: [
    'customerName',
    'businessName',
    'invoiceNumber',
    'balance',
    'amount',
    'totalAmount',
    'dueDate',
    'overdueDays',
    'paymentLink',
    'email',
    'phone',
  ],
  low_stock_detected: ['productName', 'sku', 'quantityOnHand', 'reorderLevel', 'businessName'],
  quote_no_response: ['customerName', 'businessName', 'quoteNumber', 'amount', 'email', 'phone'],
  customer_inactive_days: [
    'customerName',
    'businessName',
    'lastPurchaseDaysAgo',
    'totalSpend',
    'email',
    'phone',
  ],
  customer_birthday: ['customerName', 'businessName', 'email', 'phone', 'dateOfBirth'],
  payment_received: [
    'customerName',
    'businessName',
    'invoiceNumber',
    'amount',
    'amountPaid',
    'paymentAmount',
    'paymentMethod',
    'paymentNumber',
    'balance',
    'totalAmount',
    'email',
    'phone',
  ],
  review_request: [
    'customerName',
    'businessName',
    'reviewLink',
    'reviewUrl',
    'jobNumber',
    'saleNumber',
    'invoiceNumber',
    'sourceNumber',
    'email',
    'phone',
  ],
  job_completed: [
    'customerName',
    'businessName',
    'jobNumber',
    'jobTitle',
    'trackingLink',
    'trackingLinkLine',
    'email',
    'phone',
  ],
  daily_sales_summary: [
    'businessName',
    'date',
    'periodLabel',
    'totalSales',
    'totalSalesFormatted',
    'transactionCount',
    'topProducts',
    'email',
  ],
  new_lead: ['leadName', 'leadCompany', 'leadSource', 'businessName', 'email', 'phone'],
  high_value_invoice: ['customerName', 'businessName', 'invoiceNumber', 'totalAmount', 'totalAmountFormatted', 'email', 'phone'],
  customer_created: ['customerName', 'businessName', 'email', 'phone'],
  lead_no_contact_days: ['leadName', 'leadCompany', 'leadSource', 'noContactDays', 'businessName', 'email', 'phone'],
  invoice_sent: ['customerName', 'businessName', 'invoiceNumber', 'totalAmountFormatted', 'balance', 'paymentLink', 'dueDate', 'email', 'phone'],
  sale_completed: ['customerName', 'businessName', 'saleNumber', 'totalAmountFormatted', 'email', 'phone'],
  order_created: [
    'customerName',
    'businessName',
    'orderNumber',
    'saleNumber',
    'trackingLink',
    'trackingUrl',
    'trackingLinkLine',
    'totalAmountFormatted',
    'email',
    'phone',
  ],
  low_stock_on_change: ['productName', 'sku', 'quantityOnHand', 'reorderLevel', 'businessName'],
  out_of_stock_detected: ['productName', 'sku', 'quantityOnHand', 'reorderLevel', 'businessName'],
  quote_sent: ['customerName', 'businessName', 'quoteNumber', 'quoteTitle', 'quoteLink', 'totalAmountFormatted', 'email', 'phone'],
  job_due_in_hours: ['assigneeName', 'businessName', 'jobNumber', 'jobTitle', 'dueDate', 'customerName', 'email'],
  prescription_refill_due: ['customerName', 'businessName', 'prescriptionNumber', 'refillDueDate', 'email', 'phone'],
  low_profit_margin: ['saleNumber', 'customerName', 'businessName', 'profitMargin', 'profitMarginFormatted', 'totalAmountFormatted', 'minMarginPercent'],
};

/**
 * Default messaging/task content per trigger and action type.
 * Values use {{placeholder}} syntax resolved at send time by the automation engine.
 */
export const DEFAULT_ACTION_CONTENT = {
  invoice_due_in_days: {
    send_sms: {
      body:
        'Hi {{customerName}}, invoice {{invoiceNumber}} for {{balance}} is due on {{dueDate}}. Pay here: {{paymentLink}} — {{businessName}}',
    },
    send_whatsapp: {
      templateName: 'payment_reminder',
      language: 'en',
      parametersText: '{{customerName}}, {{invoiceNumber}}, {{balance}}, {{dueDate}}',
    },
    send_email_platform: {
      subject: 'Invoice {{invoiceNumber}} due soon',
      body:
        'Hi {{customerName}},\n\nThis is a friendly reminder that invoice {{invoiceNumber}} for {{balance}} is due on {{dueDate}}.\n\nPay online: {{paymentLink}}\n\nThank you,\n{{businessName}}',
    },
    create_task: {
      title: 'Follow up on invoice {{invoiceNumber}}',
      priority: 'medium',
      description: 'Invoice {{invoiceNumber}} is due on {{dueDate}}. Balance: {{balance}}.',
      link: '/invoices',
    },
  },
  invoice_overdue: {
    send_sms: {
      body:
        'Hi {{customerName}}, invoice {{invoiceNumber}} is overdue ({{overdueDays}} days). Balance due: {{balance}}. Pay here: {{paymentLink}} — {{businessName}}',
    },
    send_whatsapp: {
      templateName: 'payment_reminder',
      language: 'en',
      parametersText: '{{invoiceNumber}}, {{balance}}, {{paymentLink}}',
    },
    send_email_platform: {
      subject: 'Overdue invoice {{invoiceNumber}}',
      body:
        'Hi {{customerName}},\n\nInvoice {{invoiceNumber}} is now {{overdueDays}} days overdue. Outstanding balance: {{balance}}.\n\nPlease pay as soon as possible: {{paymentLink}}\n\n{{businessName}}',
    },
    create_task: {
      title: 'Collect overdue payment — {{invoiceNumber}}',
      priority: 'high',
      description: 'Invoice {{invoiceNumber}} is {{overdueDays}} days overdue. Balance: {{balance}}.',
      link: '/invoices',
    },
  },
  low_stock_detected: {
    send_sms: {
      body: 'Low stock alert: {{productName}} ({{sku}}) has {{quantityOnHand}} left. Reorder level: {{reorderLevel}}. — {{businessName}}',
    },
    send_whatsapp: {
      templateName: 'low_stock_alert',
      language: 'en',
      parametersText: '{{productName}}, {{quantityOnHand}}, {{reorderLevel}}',
    },
    send_email_platform: {
      subject: 'Low stock: {{productName}}',
      body:
        'Stock alert for {{productName}} (SKU: {{sku}}).\n\nQuantity on hand: {{quantityOnHand}}\nReorder level: {{reorderLevel}}\n\n— {{businessName}}',
    },
    create_task: {
      title: 'Restock {{productName}}',
      priority: 'high',
      description: '{{productName}} is low on stock ({{quantityOnHand}} on hand, reorder at {{reorderLevel}}).',
      link: '/materials',
    },
  },
  quote_no_response: {
    send_sms: {
      body:
        'Hi {{customerName}}, just checking in on quote {{quoteNumber}} from {{businessName}}. Reply if you have any questions or would like to proceed.',
    },
    send_whatsapp: {
      templateName: 'quote_follow_up',
      language: 'en',
      parametersText: '{{customerName}}, {{quoteNumber}}, {{businessName}}',
    },
    send_email_platform: {
      subject: 'Following up on quote {{quoteNumber}}',
      body:
        'Hi {{customerName}},\n\nWe wanted to follow up on quote {{quoteNumber}} ({{amount}}). Let us know if you have any questions or would like to move forward.\n\nBest regards,\n{{businessName}}',
    },
    create_task: {
      title: 'Follow up on quote {{quoteNumber}}',
      priority: 'medium',
      description: 'Quote {{quoteNumber}} for {{customerName}} has had no response.',
      link: '/quotes',
    },
  },
  customer_inactive_days: {
    send_sms: {
      body:
        'Hi {{customerName}}, we miss you at {{businessName}}! It has been a while since your last visit. We would love to see you again.',
    },
    send_whatsapp: {
      templateName: 'win_back',
      language: 'en',
      parametersText: '{{customerName}}, {{businessName}}',
    },
    send_email_platform: {
      subject: 'We miss you, {{customerName}}',
      body:
        'Hi {{customerName}},\n\nWe have not seen you at {{businessName}} in a while and would love to welcome you back.\n\nWarm regards,\n{{businessName}}',
    },
    create_task: {
      title: 'Win back {{customerName}}',
      priority: 'medium',
      description: 'Customer inactive for a while. Last purchase was {{lastPurchaseDaysAgo}} days ago.',
      link: '/customers',
    },
  },
  customer_birthday: {
    send_sms: {
      body:
        'Happy birthday {{customerName}}! Wishing you a wonderful day from everyone at {{businessName}}.',
    },
    send_whatsapp: {
      templateName: 'birthday_greeting',
      language: 'en',
      parametersText: '{{customerName}}',
    },
    send_email_platform: {
      subject: 'Happy birthday, {{customerName}}!',
      body:
        'Hi {{customerName}},\n\nHappy birthday from all of us at {{businessName}}! We hope you have a fantastic day.\n\nWarm wishes,\n{{businessName}}',
    },
    create_task: {
      title: 'Send birthday greeting to {{customerName}}',
      priority: 'low',
      description: 'Today is {{customerName}}\'s birthday.',
      link: '/customers',
    },
  },
  payment_received: {
    send_sms: {
      body:
        'Hi {{customerName}}, thank you! We received {{amount}} for invoice {{invoiceNumber}}. Balance: {{balance}}. — {{businessName}}',
    },
    send_whatsapp: {
      templateName: 'payment_received',
      language: 'en',
      parametersText: '{{customerName}}, {{invoiceNumber}}, {{amount}}, {{businessName}}',
    },
    send_email_platform: {
      subject: 'Payment received — thank you',
      body:
        'Hi {{customerName}},\n\nThank you! We have received your payment of {{amount}} for invoice {{invoiceNumber}}.\n\nRemaining balance: {{balance}}\n\n{{businessName}}',
    },
    create_task: {
      title: 'Payment received for {{invoiceNumber}}',
      priority: 'low',
      description: '{{customerName}} paid {{amount}} via {{paymentMethod}}.',
      link: '/invoices',
    },
  },
  review_request: {
    send_sms: {
      body:
        'Hi {{customerName}}, thank you for choosing {{businessName}}! We would love your feedback: {{reviewLink}}',
    },
    send_whatsapp: {
      templateName: 'review_request',
      language: 'en',
      parametersText: '{{customerName}}, {{businessName}}, {{reviewLink}}',
    },
    send_email_platform: {
      subject: 'How did we do, {{customerName}}?',
      body:
        'Hi {{customerName}},\n\nThank you for choosing {{businessName}}! We would love to hear about your experience.\n\nLeave a review here: {{reviewLink}}\n\nThank you,\n{{businessName}}',
    },
    create_task: {
      title: 'Follow up for review — {{customerName}}',
      priority: 'low',
      description: 'Ask {{customerName}} for a review via {{reviewLink}}.',
      link: '/customers',
    },
  },
  job_completed: {
    send_sms: {
      body:
        'Hi {{customerName}}, your job {{jobNumber}} is complete. {{trackingLinkLine}} — {{businessName}}',
    },
    send_whatsapp: {
      templateName: 'job_completed',
      language: 'en',
      parametersText: '{{customerName}}, {{jobNumber}}, {{businessName}}',
    },
    send_email_platform: {
      subject: 'Your job {{jobNumber}} is complete',
      body:
        'Hi {{customerName}},\n\nGood news! Your job {{jobNumber}} has been completed.\n\n{{trackingLinkLine}}\n\nThank you,\n{{businessName}}',
    },
    create_task: {
      title: 'Job completed — {{jobNumber}}',
      priority: 'low',
      description: 'Notify {{customerName}} that job {{jobNumber}} is complete.',
      link: '/jobs',
    },
  },
  daily_sales_summary: {
    send_sms: {
      body:
        'Daily sales ({{date}}): {{totalSalesFormatted}} from {{transactionCount}} transactions. Top: {{topProducts}}. — {{businessName}}',
    },
    send_whatsapp: {
      templateName: 'sale_receipt',
      language: 'en',
      parametersText: '{{businessName}}, {{date}}, {{totalSalesFormatted}}, {{businessName}}',
    },
    send_email_platform: {
      subject: 'Daily sales summary — {{date}}',
      body:
        'Daily sales recap for {{date}} ({{periodLabel}}):\n\nTotal sales: {{totalSalesFormatted}}\nTransactions: {{transactionCount}}\nTop products: {{topProducts}}\n\n— {{businessName}}',
    },
    create_task: {
      title: 'Review daily sales — {{date}}',
      priority: 'medium',
      description: '{{totalSalesFormatted}} from {{transactionCount}} transactions. Top: {{topProducts}}.',
      link: '/sales',
    },
  },
  new_lead: {
    send_sms: { body: 'New lead: {{leadName}} ({{leadSource}}). — {{businessName}}' },
    send_whatsapp: { templateName: 'hello_world', language: 'en', parametersText: '{{leadName}}' },
    send_email_platform: {
      subject: 'New lead: {{leadName}}',
      body: 'New lead added:\n\nName: {{leadName}}\nCompany: {{leadCompany}}\nSource: {{leadSource}}\nPhone: {{phone}}\nEmail: {{email}}\n\n— {{businessName}}',
    },
    create_task: {
      title: 'Follow up new lead — {{leadName}}',
      priority: 'medium',
      description: 'Lead {{leadName}} from {{leadSource}}.',
      link: '/leads',
    },
  },
  high_value_invoice: {
    send_sms: { body: 'High value invoice {{invoiceNumber}}: {{totalAmountFormatted}} for {{customerName}}. — {{businessName}}' },
    send_whatsapp: { templateName: 'invoice_notification', language: 'en', parametersText: '{{customerName}}, {{invoiceNumber}}, {{totalAmountFormatted}}, {{paymentLink}}' },
    send_email_platform: {
      subject: 'High value invoice — {{invoiceNumber}}',
      body: 'Invoice {{invoiceNumber}} for {{customerName}} totals {{totalAmountFormatted}}.\n\n— {{businessName}}',
    },
    create_task: {
      title: 'High value invoice — {{invoiceNumber}}',
      priority: 'high',
      description: '{{customerName}} — {{totalAmountFormatted}}.',
      link: '/invoices',
    },
  },
  customer_created: {
    send_sms: { body: 'Welcome to {{businessName}}, {{customerName}}! We look forward to serving you.' },
    send_whatsapp: { templateName: 'hello_world', language: 'en', parametersText: '{{customerName}}, {{businessName}}' },
    send_email_platform: {
      subject: 'Welcome to {{businessName}}, {{customerName}}!',
      body: 'Hi {{customerName}},\n\nWelcome to {{businessName}}! We are glad to have you.\n\n— {{businessName}}',
    },
    create_task: {
      title: 'Welcome {{customerName}}',
      priority: 'low',
      description: 'New customer {{customerName}} was added.',
      link: '/customers',
    },
  },
  lead_no_contact_days: {
    send_sms: { body: 'Follow up lead {{leadName}} — no contact for {{noContactDays}} days. — {{businessName}}' },
    send_whatsapp: { templateName: 'quote_follow_up', language: 'en', parametersText: '{{leadName}}, {{leadCompany}}, {{businessName}}' },
    send_email_platform: {
      subject: 'Follow up lead {{leadName}}',
      body: 'Lead {{leadName}} ({{leadCompany}}) has had no contact for {{noContactDays}} days.\n\n— {{businessName}}',
    },
    create_task: {
      title: 'Follow up lead — {{leadName}}',
      priority: 'medium',
      description: 'No contact for {{noContactDays}} days.',
      link: '/leads',
    },
  },
  invoice_sent: {
    send_sms: { body: 'Hi {{customerName}}, invoice {{invoiceNumber}} for {{totalAmountFormatted}} is ready. Pay: {{paymentLink}} — {{businessName}}' },
    send_whatsapp: { templateName: 'invoice_notification', language: 'en', parametersText: '{{customerName}}, {{invoiceNumber}}, {{totalAmountFormatted}}, {{paymentLink}}' },
    send_email_platform: {
      subject: 'Invoice {{invoiceNumber}} from {{businessName}}',
      body: 'Hi {{customerName}},\n\nInvoice {{invoiceNumber}} for {{totalAmountFormatted}} is ready.\n\nPay online: {{paymentLink}}\n\n— {{businessName}}',
    },
    create_task: {
      title: 'Invoice sent — {{invoiceNumber}}',
      priority: 'low',
      description: 'Sent to {{customerName}} for {{totalAmountFormatted}}.',
      link: '/invoices',
    },
  },
  sale_completed: {
    send_sms: { body: 'Hi {{customerName}}, thank you! Receipt {{saleNumber}}: {{totalAmountFormatted}}. — {{businessName}}' },
    send_whatsapp: { templateName: 'sale_receipt', language: 'en', parametersText: '{{customerName}}, {{saleNumber}}, {{totalAmountFormatted}}, {{businessName}}' },
    send_email_platform: {
      subject: 'Your receipt — {{saleNumber}}',
      body: 'Hi {{customerName}},\n\nThank you for your purchase! Receipt {{saleNumber}} totals {{totalAmountFormatted}}.\n\n— {{businessName}}',
    },
    create_task: {
      title: 'Sale completed — {{saleNumber}}',
      priority: 'low',
      description: '{{customerName}} — {{totalAmountFormatted}}.',
      link: '/sales',
    },
  },
  order_created: {
    send_sms: {
      body:
        'Hi {{customerName}}, we received order {{orderNumber}} at {{businessName}}. Track your order: {{trackingLink}}',
    },
    send_whatsapp: {
      templateName: 'order_created',
      language: 'en',
      parametersText: '{{customerName}}, {{orderNumber}}, {{totalAmountFormatted}}, {{businessName}}',
    },
    send_email_platform: {
      subject: 'Order {{orderNumber}} received — {{businessName}}',
      body:
        'Hi {{customerName}},\n\nWe have received your order {{orderNumber}}.\n\n{{trackingLinkLine}}\n\nThank you,\n{{businessName}}',
    },
    create_task: {
      title: 'Order created — {{orderNumber}}',
      priority: 'low',
      description: 'Notify {{customerName}} about order {{orderNumber}}.',
      link: '/sales',
    },
  },
  low_stock_on_change: {
    send_sms: { body: 'Low stock: {{productName}} ({{sku}}) — {{quantityOnHand}} left. — {{businessName}}' },
    send_whatsapp: { templateName: 'low_stock_alert', language: 'en', parametersText: '{{productName}}, {{quantityOnHand}}, {{reorderLevel}}' },
    send_email_platform: {
      subject: 'Low stock: {{productName}}',
      body: '{{productName}} ({{sku}}) is low: {{quantityOnHand}} on hand (reorder {{reorderLevel}}).\n\n— {{businessName}}',
    },
    create_task: {
      title: 'Restock {{productName}}',
      priority: 'high',
      description: '{{quantityOnHand}} on hand, reorder at {{reorderLevel}}.',
      link: '/materials',
    },
  },
  out_of_stock_detected: {
    send_sms: { body: 'Out of stock: {{productName}} ({{sku}}). — {{businessName}}' },
    send_whatsapp: { templateName: 'low_stock_alert', language: 'en', parametersText: '{{productName}}, {{quantityOnHand}}, {{reorderLevel}}' },
    send_email_platform: {
      subject: 'Out of stock: {{productName}}',
      body: '{{productName}} ({{sku}}) is out of stock.\n\n— {{businessName}}',
    },
    create_task: {
      title: 'Out of stock — {{productName}}',
      priority: 'high',
      description: '{{productName}} is out of stock.',
      link: '/materials',
    },
  },
  quote_sent: {
    send_sms: { body: 'Hi {{customerName}}, quote {{quoteNumber}} ({{totalAmountFormatted}}) is ready: {{quoteLink}} — {{businessName}}' },
    send_whatsapp: { templateName: 'quote_delivery', language: 'en', parametersText: '{{customerName}}, {{quoteNumber}}, {{quoteTitle}}, {{quoteLink}}' },
    send_email_platform: {
      subject: 'Your quote {{quoteNumber}} from {{businessName}}',
      body: 'Hi {{customerName}},\n\nQuote {{quoteNumber}} ({{totalAmountFormatted}}) is ready.\n\nView: {{quoteLink}}\n\n— {{businessName}}',
    },
    create_task: {
      title: 'Quote sent — {{quoteNumber}}',
      priority: 'low',
      description: 'Sent to {{customerName}}.',
      link: '/quotes',
    },
  },
  job_due_in_hours: {
    send_email_platform: {
      subject: 'Job {{jobNumber}} due soon',
      body: 'Hi {{assigneeName}},\n\nJob {{jobNumber}} for {{customerName}} is due on {{dueDate}}.\n\nPlease prioritize this work before the due date.\n\n— {{businessName}}',
    },
    create_task: {
      title: 'Job due soon — {{jobNumber}}',
      priority: 'medium',
      description: 'Job {{jobNumber}} for {{customerName}} is due on {{dueDate}}.',
      link: '/jobs',
    },
  },
  prescription_refill_due: {
    send_sms: { body: 'Hi {{customerName}}, prescription {{prescriptionNumber}} refill due {{refillDueDate}}. — {{businessName}}' },
    send_whatsapp: { templateName: 'hello_world', language: 'en', parametersText: '{{customerName}}, {{prescriptionNumber}}' },
    send_email_platform: {
      subject: 'Prescription refill — {{prescriptionNumber}}',
      body: 'Hi {{customerName}},\n\nYour prescription {{prescriptionNumber}} refill is due on {{refillDueDate}}.\n\n— {{businessName}}',
    },
    create_task: {
      title: 'Refill due — {{prescriptionNumber}}',
      priority: 'medium',
      description: '{{customerName}} refill due {{refillDueDate}}.',
      link: '/prescriptions',
    },
  },
  low_profit_margin: {
    send_sms: { body: 'Low margin sale {{saleNumber}}: {{profitMarginFormatted}}. — {{businessName}}' },
    send_whatsapp: { templateName: 'hello_world', language: 'en', parametersText: '{{saleNumber}}, {{profitMarginFormatted}}' },
    send_email_platform: {
      subject: 'Low margin alert — {{saleNumber}}',
      body: 'Sale {{saleNumber}} margin is {{profitMarginFormatted}} (threshold {{minMarginPercent}}%). Total: {{totalAmountFormatted}}.\n\n— {{businessName}}',
    },
    create_task: {
      title: 'Low margin sale — {{saleNumber}}',
      priority: 'high',
      description: 'Margin {{profitMarginFormatted}} on {{totalAmountFormatted}}.',
      link: '/sales',
    },
  },
};

/**
 * @param {string} triggerType
 * @returns {string[]}
 */
export function getTriggerPlaceholders(triggerType) {
  return TRIGGER_PLACEHOLDERS[triggerType] || ['customerName', 'businessName'];
}

/**
 * @param {string} triggerType
 * @returns {string}
 */
export function formatPlaceholderHint(triggerType) {
  const keys = getTriggerPlaceholders(triggerType);
  return keys.map((key) => `{{${key}}}`).join(', ');
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isEmptyActionField(value) {
  return value == null || String(value).trim() === '';
}

/**
 * @param {string} triggerType
 * @param {string} actionType
 * @returns {Record<string, unknown>}
 */
export function getDefaultActionContent(triggerType, actionType) {
  return DEFAULT_ACTION_CONTENT[triggerType]?.[actionType] || {};
}

/**
 * Merge trigger-specific defaults into an action row without overwriting user edits.
 * @param {Record<string, unknown>} row
 * @param {string} triggerType
 * @returns {Record<string, unknown>}
 */
export function prefillActionRow(row, triggerType) {
  if (!row?.type || !triggerType) return row;
  const defaults = getDefaultActionContent(triggerType, row.type);
  const out = { ...row };
  for (const [key, value] of Object.entries(defaults)) {
    if (isEmptyActionField(out[key])) {
      out[key] = value;
    }
  }
  return out;
}

/**
 * @param {Record<string, unknown>[]} actionRows
 * @param {string} triggerType
 * @returns {Record<string, unknown>[]}
 */
export function prefillActionRows(actionRows, triggerType) {
  return (actionRows || []).map((row) => prefillActionRow(row, triggerType));
}

/**
 * Whether an automation rule includes outbound messaging actions.
 * @param {Record<string, unknown>[]} actionRows
 * @returns {boolean}
 */
export function ruleHasMessagingActions(actionRows) {
  return (actionRows || []).some((row) => MESSAGING_ACTION_TYPES.includes(row?.type));
}

/**
 * Recipient fields required for messaging test runs.
 * @param {Record<string, unknown>[]} actionRows
 * @returns {{ needsPhone: boolean, needsEmail: boolean }}
 */
export function messagingActionRequirements(actionRows) {
  const types = new Set((actionRows || []).map((row) => row?.type).filter(Boolean));
  return {
    needsPhone: types.has('send_sms') || types.has('send_whatsapp'),
    needsEmail: types.has('send_email_platform'),
  };
}

/**
 * Merge a real test recipient into automation trigger context.
 * @param {Record<string, unknown>} baseContext
 * @param {Record<string, unknown>} recipient
 * @returns {Record<string, unknown>}
 */
export function buildTestRecipientContext(baseContext = {}, recipient = {}) {
  const name = String(recipient.name || recipient.customerName || baseContext.customerName || 'Test Customer').trim();
  const phone = String(recipient.phone || baseContext.phone || '').trim();
  const email = String(recipient.email || baseContext.email || '').trim();
  const customerId = recipient.customerId || recipient.id || baseContext.customerId || 'test-customer';
  const dateOfBirth = recipient.dateOfBirth || baseContext.customer?.dateOfBirth || baseContext.dateOfBirth;

  const customer = {
    ...(baseContext.customer && typeof baseContext.customer === 'object' ? baseContext.customer : {}),
    id: customerId,
    name,
    company: recipient.company || baseContext.customer?.company || name,
    email,
    phone,
    dateOfBirth,
    whatsappConsent: true,
    smsConsent: true,
    marketingConsent: true,
  };

  return {
    ...baseContext,
    customerId,
    customerName: name,
    recipientName: name,
    email,
    phone,
    dateOfBirth,
    customerHasPhone: Boolean(phone),
    customerHasEmail: Boolean(email),
    customer,
  };
}

export const TASK_PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

/** Sticky (condition-while-true) triggers that show the repeat-frequency control. */
export const STICKY_TRIGGER_TYPES = [
  'invoice_overdue',
  'invoice_due_in_days',
  'quote_no_response',
  'lead_no_contact_days',
  'customer_inactive_days',
  'low_stock_detected',
  'out_of_stock_detected',
  'low_stock_on_change',
  'job_due_in_hours',
];

export const FREQUENCY_OPTIONS = [
  { value: 'once', label: 'Once only' },
  { value: 'daily', label: 'Daily' },
  { value: 'every_n_days', label: 'Every N days' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const FREQUENCY_COOLDOWN_HOURS = {
  daily: 24,
  weekly: 168,
  monthly: 720,
};

/**
 * @param {string} triggerType
 * @returns {boolean}
 */
export function isStickyTrigger(triggerType) {
  return STICKY_TRIGGER_TYPES.includes(String(triggerType || ''));
}

/**
 * Default frequency for sticky triggers when creating a new rule.
 * Overdue defaults to weekly to avoid daily spam.
 * @param {string} triggerType
 * @returns {string}
 */
export function defaultFrequencyForTrigger(triggerType) {
  if (triggerType === 'invoice_overdue') return 'weekly';
  if (isStickyTrigger(triggerType)) return 'daily';
  return '';
}

/**
 * Map frequency form fields to engine scheduleConfig (including derived cooldownHours / maxSends).
 * @param {{ frequency?: string, intervalDays?: string|number, cooldownDays?: string|number }} form
 * @param {string} triggerType
 * @returns {Record<string, unknown>}
 */
export function buildScheduleConfigFromForm(form = {}, triggerType) {
  if (isStickyTrigger(triggerType)) {
    const frequency = FREQUENCY_OPTIONS.some((o) => o.value === form.frequency)
      ? form.frequency
      : defaultFrequencyForTrigger(triggerType);
    const schedule = { frequency };
    if (frequency === 'once') {
      schedule.maxSends = 1;
      return schedule;
    }
    if (frequency === 'every_n_days') {
      const intervalDays = Math.max(1, Math.min(365, Number(form.intervalDays) || 1));
      schedule.intervalDays = intervalDays;
      schedule.cooldownHours = intervalDays * 24;
      return schedule;
    }
    schedule.cooldownHours = FREQUENCY_COOLDOWN_HOURS[frequency] || FREQUENCY_COOLDOWN_HOURS.daily;
    return schedule;
  }

  // Non-sticky: preserve optional legacy cooldown days only.
  const scheduleConfig = {};
  if (form?.cooldownDays !== '' && form?.cooldownDays != null) {
    const n = Number(form.cooldownDays);
    if (!Number.isNaN(n) && n > 0) scheduleConfig.cooldownHours = Math.round(n * 24);
  }
  return scheduleConfig;
}

/**
 * Infer frequency UI state from a saved scheduleConfig.
 * @param {Record<string, unknown>} scheduleConfig
 * @param {string} [triggerType]
 * @returns {{ frequency: string, intervalDays: string, cooldownDays: string }}
 */
export function scheduleFormFromConfig(scheduleConfig = {}, triggerType = '') {
  const s = scheduleConfig && typeof scheduleConfig === 'object' ? scheduleConfig : {};
  const cooldownHours = Number(s.cooldownHours) > 0 ? Number(s.cooldownHours) : 0;
  const sticky = isStickyTrigger(triggerType);

  if (s.frequency === 'once' || Number(s.maxSends) === 1) {
    return { frequency: 'once', intervalDays: '1', cooldownDays: '' };
  }
  if (FREQUENCY_OPTIONS.some((o) => o.value === s.frequency)) {
    return {
      frequency: s.frequency,
      intervalDays: String(Math.max(1, Number(s.intervalDays) || 1)),
      cooldownDays: cooldownHours > 0 ? String(cooldownHours / 24) : '',
    };
  }

  // Lazy normalize: sticky rules with empty schedule → daily (matches engine).
  // New overdue templates set weekly explicitly in scheduleConfig.
  if (sticky && !s.frequency && cooldownHours <= 0) {
    return {
      frequency: 'daily',
      intervalDays: '1',
      cooldownDays: '',
    };
  }

  // Infer from legacy cooldownHours when frequency is missing.
  if (sticky && cooldownHours > 0) {
    if (cooldownHours === 24) return { frequency: 'daily', intervalDays: '1', cooldownDays: '1' };
    if (cooldownHours === 168) return { frequency: 'weekly', intervalDays: '1', cooldownDays: '7' };
    if (cooldownHours === 720) return { frequency: 'monthly', intervalDays: '1', cooldownDays: '30' };
    if (cooldownHours % 24 === 0) {
      return {
        frequency: 'every_n_days',
        intervalDays: String(cooldownHours / 24),
        cooldownDays: String(cooldownHours / 24),
      };
    }
  }

  return {
    frequency: sticky ? 'daily' : '',
    intervalDays: '1',
    cooldownDays: cooldownHours > 0 ? String(cooldownHours / 24) : '',
  };
}

/**
 * @param {string} triggerType
 * @returns {Record<string, unknown>}
 */
export function defaultTriggerForm(triggerType) {
  switch (triggerType) {
    case 'invoice_due_in_days':
      return { daysBeforeDue: 2 };
    case 'invoice_overdue':
      return { daysAfterDue: 1 };
    case 'low_stock_detected':
      return { thresholdMode: 'reorder_level', fixedThreshold: 5 };
    case 'quote_no_response':
      return { silentDays: 7 };
    case 'customer_inactive_days':
      return { inactiveDays: 30 };
    case 'customer_birthday':
      return {};
    case 'payment_received':
      return {};
    case 'review_request':
      return {};
    case 'job_completed':
      return {};
    case 'daily_sales_summary':
      return { summaryPeriod: 'yesterday' };
    case 'new_lead':
      return {};
    case 'high_value_invoice':
      return { minAmount: 1000 };
    case 'customer_created':
      return {};
    case 'lead_no_contact_days':
      return { noContactDays: 3 };
    case 'invoice_sent':
      return {};
    case 'sale_completed':
      return {};
    case 'order_created':
      return {};
    case 'low_stock_on_change':
      return { thresholdMode: 'reorder_level', fixedThreshold: 5 };
    case 'out_of_stock_detected':
      return {};
    case 'quote_sent':
      return {};
    case 'job_due_in_hours':
      return { hoursBeforeDue: 24 };
    case 'prescription_refill_due':
      return { daysBeforeDue: 3 };
    case 'low_profit_margin':
      return { minMarginPercent: 15 };
    default:
      return {};
  }
}

/**
 * @param {string} triggerType
 * @param {Record<string, unknown>} patch
 */
export function mergeTriggerForm(triggerType, patch = {}) {
  return { ...defaultTriggerForm(triggerType), ...patch };
}

/**
 * @param {string} triggerType
 * @param {Record<string, unknown>} triggerForm
 */
export function buildTriggerConfig(triggerType, triggerForm) {
  const base = defaultTriggerForm(triggerType);
  const merged = { ...base, ...(triggerForm && typeof triggerForm === 'object' ? triggerForm : {}) };
  switch (triggerType) {
    case 'invoice_due_in_days':
      return {
        daysBeforeDue: Math.max(0, Math.min(365, Number(merged.daysBeforeDue) || 0)),
      };
    case 'invoice_overdue':
      return {
        daysAfterDue: Math.max(0, Math.min(365, Number(merged.daysAfterDue) || 0)),
      };
    case 'low_stock_detected': {
      const mode = merged.thresholdMode === 'fixed' ? 'fixed' : 'reorder_level';
      const out = { thresholdMode: mode };
      if (mode === 'fixed') {
        out.fixedThreshold = Math.max(0, Number(merged.fixedThreshold) || 0);
      }
      return out;
    }
    case 'quote_no_response':
      return {
        silentDays: Math.max(1, Math.min(365, Number(merged.silentDays) || 7)),
      };
    case 'customer_inactive_days':
      return {
        inactiveDays: Math.max(1, Math.min(730, Number(merged.inactiveDays) || 30)),
      };
    case 'customer_birthday':
      return {};
    case 'payment_received':
      return {};
    case 'review_request':
      return {};
    case 'job_completed':
      return {};
    case 'daily_sales_summary':
      return {
        summaryPeriod: merged.summaryPeriod === 'today' ? 'today' : 'yesterday',
      };
    case 'high_value_invoice':
      return {
        minAmount: Math.max(0, Number(merged.minAmount) || 1000),
      };
    case 'lead_no_contact_days':
      return {
        noContactDays: Math.max(1, Math.min(365, Number(merged.noContactDays) || 3)),
      };
    case 'job_due_in_hours':
      return {
        hoursBeforeDue: Math.max(1, Math.min(168, Number(merged.hoursBeforeDue) || 24)),
      };
    case 'prescription_refill_due':
      return {
        daysBeforeDue: Math.max(0, Math.min(30, Number(merged.daysBeforeDue) || 3)),
      };
    case 'low_profit_margin':
      return {
        minMarginPercent: Math.max(0, Math.min(100, Number(merged.minMarginPercent) || 15)),
      };
    case 'low_stock_on_change': {
      const mode = merged.thresholdMode === 'fixed' ? 'fixed' : 'reorder_level';
      const out = { thresholdMode: mode };
      if (mode === 'fixed') {
        out.fixedThreshold = Math.max(0, Number(merged.fixedThreshold) || 0);
      }
      return out;
    }
    case 'new_lead':
    case 'customer_created':
    case 'invoice_sent':
    case 'sale_completed':
    case 'order_created':
    case 'out_of_stock_detected':
    case 'quote_sent':
      return {};
    default:
      return merged && typeof merged === 'object' && !Array.isArray(merged) ? merged : {};
  }
}

/**
 * @param {string} [type]
 * @param {string} [triggerType] - When set, pre-fills messaging fields from DEFAULT_ACTION_CONTENT.
 */
export function defaultActionFormRow(type = 'create_task', triggerType = null) {
  let row;
  switch (type) {
    case 'create_task':
      row = {
        type: 'create_task',
        title: 'Follow up',
        priority: 'medium',
        description: '',
        link: '',
      };
      break;
    case 'send_email_platform':
      row = {
        type: 'send_email_platform',
        subject: '',
        body: '',
      };
      break;
    case 'send_sms':
      row = {
        type: 'send_sms',
        body: '',
      };
      break;
    case 'send_whatsapp':
      row = {
        type: 'send_whatsapp',
        templateName: '',
        language: 'en',
        parametersText: '',
      };
      break;
    default:
      return defaultActionFormRow('create_task', triggerType);
  }
  return triggerType ? prefillActionRow(row, triggerType) : row;
}

/**
 * @param {Record<string, unknown>} row
 */
export function actionFormRowToPayload(row) {
  const t = row?.type || 'create_task';
  if (t === 'create_task') {
    const title = String(row.title || '').trim();
    const out = {
      type: 'create_task',
      title: title || 'Follow up',
      priority: ['low', 'medium', 'high'].includes(row.priority) ? row.priority : 'medium',
    };
    if (String(row.description || '').trim()) out.description = String(row.description).trim();
    if (String(row.link || '').trim()) out.link = String(row.link).trim();
    return out;
  }
  if (t === 'send_email_platform') {
    return {
      type: 'send_email_platform',
      subject: String(row.subject || '').trim() || 'Notification',
      body: String(row.body || '').trim(),
    };
  }
  if (t === 'send_sms') {
    return {
      type: 'send_sms',
      body: String(row.body || '').trim(),
    };
  }
  if (t === 'send_whatsapp') {
    const params = String(row.parametersText ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return {
      type: 'send_whatsapp',
      templateName: String(row.templateName || '').trim() || 'hello_world',
      language: String(row.language || 'en').trim() || 'en',
      parameters: params.length ? params : Array.isArray(row.parameters) ? row.parameters : [],
    };
  }
  return actionFormRowToPayload(defaultActionFormRow('create_task'));
}

/**
 * @param {{ actions?: unknown[] }} [actionConfig]
 * @returns {Record<string, unknown>[]}
 */
export function actionRowsFromConfig(actionConfig) {
  const raw = actionConfig?.actions;
  if (!Array.isArray(raw) || raw.length === 0) {
    return [defaultActionFormRow('create_task')];
  }
  return raw.map((a) => {
    if (!a || typeof a !== 'object') return defaultActionFormRow();
    if (a.type === 'create_task') {
      return {
        type: 'create_task',
        title: a.title ?? '',
        priority: a.priority ?? 'medium',
        description: a.description ?? '',
        link: a.link ?? '',
      };
    }
    if (a.type === 'send_email_platform') {
      return {
        type: 'send_email_platform',
        subject: a.subject ?? '',
        body: a.body ?? '',
      };
    }
    if (a.type === 'send_sms') {
      return {
        type: 'send_sms',
        body: a.body ?? '',
      };
    }
    if (a.type === 'send_whatsapp') {
      const params = Array.isArray(a.parameters) ? a.parameters : [];
      return {
        type: 'send_whatsapp',
        templateName: a.templateName ?? '',
        language: a.language ?? 'en',
        parametersText: params.length ? params.join(', ') : '',
      };
    }
    return defaultActionFormRow();
  });
}

/**
 * @param {{ minInvoiceAmount?: string, weekdaysOnly?: boolean }} form
 */
export function buildConditionConfig(form) {
  const o = {};
  const addNumberCondition = (valueKey, operatorKey, outValueKey, outOperatorKey, allowedOperators = ['greater_than', 'less_than', 'equal_to']) => {
    const raw = form?.[valueKey];
    if (raw === '' || raw == null || String(raw).trim() === '') return;
    const n = Number(raw);
    if (Number.isNaN(n) || n < 0) return;
    o[outValueKey] = n;
    const operator = allowedOperators.includes(form?.[operatorKey]) ? form[operatorKey] : allowedOperators[0];
    o[outOperatorKey] = operator;
  };
  const addBooleanCondition = (formKey, outKey) => {
    if (form?.[formKey] === 'yes') o[outKey] = true;
    if (form?.[formKey] === 'no') o[outKey] = false;
  };

  addNumberCondition('invoiceAmountValue', 'invoiceAmountOperator', 'invoiceAmountValue', 'invoiceAmountOperator');
  addNumberCondition('balanceDueValue', 'balanceDueOperator', 'balanceDueValue', 'balanceDueOperator');
  addNumberCondition('overdueDaysValue', 'overdueDaysOperator', 'overdueDaysValue', 'overdueDaysOperator');
  addNumberCondition('totalSpendValue', 'totalSpendOperator', 'totalSpendValue', 'totalSpendOperator');
  addNumberCondition('quantityValue', 'quantityOperator', 'quantityValue', 'quantityOperator', ['less_than']);

  if (form?.invoiceStatus) o.invoiceStatus = String(form.invoiceStatus);
  if (form?.paymentStatus) o.paymentStatus = String(form.paymentStatus);
  if (form?.birthdayMatch) o.birthdayMatch = String(form.birthdayMatch);

  addBooleanCondition('hasOverdueInvoices', 'hasOverdueInvoices');
  addBooleanCondition('customerHasPhone', 'customerHasPhone');
  addBooleanCondition('customerHasEmail', 'customerHasEmail');
  addBooleanCondition('whatsappConsent', 'whatsappConsent');
  addBooleanCondition('smsConsent', 'smsConsent');
  addBooleanCondition('marketingConsent', 'marketingConsent');

  if (form?.lastPurchaseOlderThanDays !== '' && form?.lastPurchaseOlderThanDays != null) {
    const n = Number(form.lastPurchaseOlderThanDays);
    if (!Number.isNaN(n) && n >= 0) o.lastPurchaseOlderThanDays = n;
  }
  if (form?.stockBelowReorderLevel) o.stockBelowReorderLevel = true;

  // Backward compatibility with older saved builder state.
  const raw = form?.minInvoiceAmount;
  if (raw !== '' && raw != null && String(raw).trim() !== '' && o.invoiceAmountValue == null) {
    const n = Number(raw);
    if (!Number.isNaN(n) && n >= 0) {
      o.invoiceAmountValue = n;
      o.invoiceAmountOperator = 'greater_than';
      o.minInvoiceAmount = n;
    }
  }
  if (form?.weekdaysOnly) o.weekdaysOnly = true;
  if (form?.runAfterTime) o.runAfterTime = String(form.runAfterTime);
  if (form?.runBeforeTime) o.runBeforeTime = String(form.runBeforeTime);
  return o;
}

/**
 * @param {Record<string, unknown>} conditionConfig
 * @param {Record<string, unknown>} scheduleConfig
 * @param {string} [triggerType]
 */
export function conditionFormFromConfig(conditionConfig, scheduleConfig = {}, triggerType = '') {
  const c = conditionConfig && typeof conditionConfig === 'object' ? conditionConfig : {};
  const s = scheduleConfig && typeof scheduleConfig === 'object' ? scheduleConfig : {};
  const boolToChoice = (value) => (value === true ? 'yes' : value === false ? 'no' : '');
  const legacyMinInvoiceAmount = c.invoiceAmountValue == null && c.minInvoiceAmount != null ? c.minInvoiceAmount : c.invoiceAmountValue;
  const scheduleForm = scheduleFormFromConfig(s, triggerType);
  return {
    minInvoiceAmount: c.minInvoiceAmount != null ? String(c.minInvoiceAmount) : '',
    invoiceAmountOperator: c.invoiceAmountOperator || 'greater_than',
    invoiceAmountValue: legacyMinInvoiceAmount != null ? String(legacyMinInvoiceAmount) : '',
    balanceDueOperator: c.balanceDueOperator || 'greater_than',
    balanceDueValue: c.balanceDueValue != null ? String(c.balanceDueValue) : '',
    invoiceStatus: c.invoiceStatus || '',
    paymentStatus: c.paymentStatus || '',
    overdueDaysOperator: c.overdueDaysOperator || 'greater_than',
    overdueDaysValue: c.overdueDaysValue != null ? String(c.overdueDaysValue) : '',
    hasOverdueInvoices: boolToChoice(c.hasOverdueInvoices),
    customerHasPhone: boolToChoice(c.customerHasPhone),
    customerHasEmail: boolToChoice(c.customerHasEmail),
    whatsappConsent: boolToChoice(c.whatsappConsent),
    smsConsent: boolToChoice(c.smsConsent),
    marketingConsent: boolToChoice(c.marketingConsent),
    lastPurchaseOlderThanDays: c.lastPurchaseOlderThanDays != null ? String(c.lastPurchaseOlderThanDays) : '',
    totalSpendOperator: c.totalSpendOperator || 'greater_than',
    totalSpendValue: c.totalSpendValue != null ? String(c.totalSpendValue) : '',
    birthdayMatch: c.birthdayMatch || '',
    weekdaysOnly: c.weekdaysOnly === true,
    runAfterTime: c.runAfterTime || '',
    runBeforeTime: c.runBeforeTime || '',
    cooldownDays: scheduleForm.cooldownDays,
    frequency: scheduleForm.frequency,
    intervalDays: scheduleForm.intervalDays,
    stockBelowReorderLevel: c.stockBelowReorderLevel === true,
    quantityOperator: c.quantityOperator || 'less_than',
    quantityValue: c.quantityValue != null ? String(c.quantityValue) : '',
  };
}

/**
 * @param {string} raw
 * @param {string} fieldLabel
 * @returns {Record<string, unknown>}
 */
export function parseJsonObject(raw, fieldLabel) {
  const s = (raw ?? '').trim();
  if (!s) return {};
  try {
    const parsed = JSON.parse(s);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`${fieldLabel} must be a JSON object (e.g. {}).`);
    }
    return parsed;
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw new Error(`${fieldLabel} is not valid JSON.`);
    }
    throw e instanceof Error ? e : new Error(`${fieldLabel} is invalid.`);
  }
}

/**
 * @param {object} params
 * @param {string} params.name
 * @param {string} params.triggerType
 * @param {Record<string, unknown>} params.triggerForm
 * @param {{ minInvoiceAmount: string, weekdaysOnly: boolean, frequency?: string, intervalDays?: string, cooldownDays?: string }} params.conditionForm
 * @param {Record<string, unknown>[]} params.actionRows
 */
export function buildRulePayloadFromForm({ name, triggerType, triggerForm, conditionForm, actionRows }) {
  const actions = (actionRows || []).map((r) => actionFormRowToPayload(r));
  const scheduleConfig = buildScheduleConfigFromForm(conditionForm, triggerType);
  return {
    name: String(name).trim(),
    triggerType: String(triggerType).trim(),
    triggerConfig: buildTriggerConfig(triggerType, triggerForm),
    conditionConfig: buildConditionConfig(conditionForm),
    actionConfig: { actions },
    scheduleConfig,
  };
}

/**
 * Build a representative record for manually testing an automation rule.
 * @param {object} params
 * @param {string} params.name
 * @param {string} params.triggerType
 * @param {Record<string, unknown>} params.triggerForm
 * @param {{ minInvoiceAmount: string, weekdaysOnly: boolean }} params.conditionForm
 * @param {Record<string, unknown>[]} params.actionRows
 * @returns {Record<string, unknown>}
 */
export function buildTestContextFromForm({ name, triggerType, triggerForm, conditionForm, actionRows }) {
  const payload = buildRulePayloadFromForm({ name, triggerType, triggerForm, conditionForm, actionRows });
  const minAmount = Number(payload.conditionConfig?.minInvoiceAmount || 0);
  const amountCondition = Number(payload.conditionConfig?.invoiceAmountValue || minAmount || 0);
  const matchingNumber = (value, operator, fallback = 100) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    if (operator === 'less_than') return Math.max(0, n - 1);
    if (operator === 'equal_to') return n;
    return n + 10;
  };
  const amount = Math.max(0, matchingNumber(amountCondition, payload.conditionConfig?.invoiceAmountOperator, 100));
  const balance = Math.max(0, matchingNumber(payload.conditionConfig?.balanceDueValue ?? amount, payload.conditionConfig?.balanceDueOperator, amount));
  const totalSpend = Math.max(0, matchingNumber(payload.conditionConfig?.totalSpendValue ?? amount * 3, payload.conditionConfig?.totalSpendOperator, amount * 3));
  const quantityOnHand = Math.max(0, matchingNumber(payload.conditionConfig?.quantityValue ?? 2, payload.conditionConfig?.quantityOperator, 2));
  const today = new Date();
  const sampleDueDate = new Date(today);
  if (payload.triggerType === 'invoice_overdue') {
    sampleDueDate.setDate(today.getDate() - Number(payload.triggerConfig?.daysAfterDue ?? 1));
  } else {
    sampleDueDate.setDate(today.getDate() + Number(payload.triggerConfig?.daysBeforeDue ?? 2));
  }
  const dueDateIso = sampleDueDate.toISOString().slice(0, 10);

  const customer = {
    id: 'test-customer',
    name: 'Test Customer',
    company: 'Test Customer Co.',
    email: '',
    phone: '',
    dateOfBirth: today.toISOString().slice(0, 10),
    whatsappConsent: true,
    smsConsent: true,
    marketingConsent: true,
  };
  const invoice = {
    id: 'test-invoice',
    invoiceNumber: 'INV-TEST-0001',
    customerId: customer.id,
    totalAmount: amount,
    amountPaid: 0,
    balance,
    dueDate: dueDateIso,
    status: payload.conditionConfig?.invoiceStatus || (payload.triggerType === 'invoice_overdue' ? 'overdue' : 'sent'),
    paymentToken: 'test',
  };
  const quote = {
    id: 'test-quote',
    quoteNumber: 'QTE-TEST-0001',
    customerId: customer.id,
    totalAmount: amount,
  };
  const product = {
    id: 'test-product',
    name: 'Test Product',
    sku: 'TEST-SKU',
    quantityOnHand,
    reorderLevel: 5,
    isActive: true,
  };

  return {
    subjectKey: `test:${payload.triggerType}:${Date.now()}`,
    triggerType: payload.triggerType,
    scheduler: false,
    manualTest: true,
    test: true,
    businessName: 'Test Business',
    customerId: customer.id,
    customerName: customer.name,
    email: customer.email,
    phone: customer.phone,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    quoteId: quote.id,
    quoteNumber: quote.quoteNumber,
    productId: product.id,
    productName: product.name,
    sku: product.sku,
    quantityOnHand: product.quantityOnHand,
    reorderLevel: product.reorderLevel,
    amount,
    balance,
    totalAmount: amount,
    invoiceStatus: invoice.status,
    paymentStatus: payload.conditionConfig?.paymentStatus || 'unpaid',
    overdueDays: matchingNumber(payload.conditionConfig?.overdueDaysValue ?? (payload.triggerType === 'invoice_overdue' ? Number(payload.triggerConfig?.daysAfterDue || 1) : 0), payload.conditionConfig?.overdueDaysOperator, 0),
    hasOverdueInvoices: payload.conditionConfig?.hasOverdueInvoices ?? (payload.triggerType === 'invoice_overdue'),
    customerHasPhone: false,
    customerHasEmail: false,
    whatsappConsent: true,
    smsConsent: true,
    marketingConsent: true,
    lastPurchaseDaysAgo: 45,
    totalSpend,
    dueDate: invoice.dueDate,
    paymentLink: 'http://localhost:3000/pay-invoice/test',
    reviewLink: 'http://localhost:3000/review/sample-workspace',
    reviewUrl: 'http://localhost:3000/review/sample-workspace',
    jobNumber: 'JOB-TEST-0001',
    jobTitle: 'Sample print job',
    trackingLink: 'http://localhost:3000/track-job/sample-token',
    trackingLinkLine: 'Track your order: http://localhost:3000/track-job/sample-token',
    saleNumber: 'SALE-TEST-0001',
    orderNumber: 'SALE-TEST-0001',
    sourceNumber: 'JOB-TEST-0001',
    leadName: 'Sample Lead',
    leadCompany: 'Sample Lead Co',
    leadSource: 'website',
    noContactDays: 3,
    quoteTitle: 'Sample quote',
    quoteLink: 'http://localhost:3000/view-quote/sample',
    totalAmountFormatted: `GHS ${amount.toFixed(2)}`,
    profitMargin: 12.5,
    profitMarginFormatted: '12.5%',
    minMarginPercent: 15,
    prescriptionNumber: 'RX-TEST-0001',
    refillDueDate: dueDateIso,
    hoursBeforeDue: 24,
    date: today.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
    periodLabel: payload.triggerType === 'daily_sales_summary' && payload.triggerConfig?.summaryPeriod === 'today' ? 'today' : 'yesterday',
    totalSales: amount,
    totalSalesFormatted: `GHS ${amount.toFixed(2)}`,
    transactionCount: 12,
    topProducts: 'Sample Product A (GHS 450.00), Sample Product B (GHS 320.00)',
    message: `Test automation run for ${payload.name || 'automation rule'}.`,
    customer,
    invoice,
    quote,
    product,
  };
}

export function triggerLabel(triggerType) {
  return TRIGGER_OPTIONS.find((o) => o.value === triggerType)?.label || triggerType;
}
