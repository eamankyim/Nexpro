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

export const TASK_PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

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
    default:
      return merged && typeof merged === 'object' && !Array.isArray(merged) ? merged : {};
  }
}

/**
 * @param {string} [type]
 */
export function defaultActionFormRow(type = 'create_task') {
  switch (type) {
    case 'create_task':
      return {
        type: 'create_task',
        title: 'Follow up',
        priority: 'medium',
        description: '',
        link: '',
      };
    case 'send_email_platform':
      return {
        type: 'send_email_platform',
        subject: '',
        body: '',
      };
    case 'send_sms':
      return {
        type: 'send_sms',
        body: '',
      };
    case 'send_whatsapp':
      return {
        type: 'send_whatsapp',
        templateName: '',
        language: 'en',
        parametersText: '',
      };
    default:
      return defaultActionFormRow('create_task');
  }
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
 */
export function conditionFormFromConfig(conditionConfig, scheduleConfig = {}) {
  const c = conditionConfig && typeof conditionConfig === 'object' ? conditionConfig : {};
  const s = scheduleConfig && typeof scheduleConfig === 'object' ? scheduleConfig : {};
  const boolToChoice = (value) => (value === true ? 'yes' : value === false ? 'no' : '');
  const legacyMinInvoiceAmount = c.invoiceAmountValue == null && c.minInvoiceAmount != null ? c.minInvoiceAmount : c.invoiceAmountValue;
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
    cooldownDays: Number(s.cooldownHours) > 0 ? String(Number(s.cooldownHours) / 24) : '',
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
 * @param {{ minInvoiceAmount: string, weekdaysOnly: boolean }} params.conditionForm
 * @param {Record<string, unknown>[]} params.actionRows
 */
export function buildRulePayloadFromForm({ name, triggerType, triggerForm, conditionForm, actionRows }) {
  const actions = (actionRows || []).map((r) => actionFormRowToPayload(r));
  const scheduleConfig = {};
  if (conditionForm?.cooldownDays !== '' && conditionForm?.cooldownDays != null) {
    const n = Number(conditionForm.cooldownDays);
    if (!Number.isNaN(n) && n > 0) scheduleConfig.cooldownHours = Math.round(n * 24);
  }
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
  const dueDate = new Date(today);
  dueDate.setDate(today.getDate() + Number(payload.triggerConfig?.daysBeforeDue || 2));

  const customer = {
    id: 'test-customer',
    name: 'Test Customer',
    company: 'Test Customer Co.',
    email: 'customer@example.com',
    phone: '+233200000000',
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
    dueDate: dueDate.toISOString().slice(0, 10),
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
    customerHasPhone: true,
    customerHasEmail: true,
    whatsappConsent: true,
    smsConsent: true,
    marketingConsent: true,
    lastPurchaseDaysAgo: 45,
    totalSpend,
    dueDate: invoice.dueDate,
    paymentLink: 'http://localhost:3000/pay-invoice/test',
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
