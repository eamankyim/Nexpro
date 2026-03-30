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
  const raw = form?.minInvoiceAmount;
  if (raw !== '' && raw != null && String(raw).trim() !== '') {
    const n = Number(raw);
    if (!Number.isNaN(n) && n >= 0) o.minInvoiceAmount = n;
  }
  if (form?.weekdaysOnly) o.weekdaysOnly = true;
  return o;
}

/**
 * @param {Record<string, unknown>} conditionConfig
 */
export function conditionFormFromConfig(conditionConfig) {
  const c = conditionConfig && typeof conditionConfig === 'object' ? conditionConfig : {};
  return {
    minInvoiceAmount: c.minInvoiceAmount != null ? String(c.minInvoiceAmount) : '',
    weekdaysOnly: c.weekdaysOnly === true,
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
  return {
    name: String(name).trim(),
    triggerType: String(triggerType).trim(),
    triggerConfig: buildTriggerConfig(triggerType, triggerForm),
    conditionConfig: buildConditionConfig(conditionForm),
    actionConfig: { actions },
    scheduleConfig: {},
  };
}

export function triggerLabel(triggerType) {
  return TRIGGER_OPTIONS.find((o) => o.value === triggerType)?.label || triggerType;
}
