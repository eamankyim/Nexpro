const { Op, col, fn, where: sequelizeWhere } = require('sequelize');
const { AutomationRule, AutomationRun, Customer, Invoice, Product, Quote, Sale, Tenant, UserTask } = require('../models');
const emailService = require('./emailService');
const smsService = require('./smsService');
const whatsappService = require('./whatsappService');
const emailTemplates = require('./emailTemplates');
const whatsappTemplates = require('./whatsappTemplates');

const DEDUPE_WINDOW_HOURS = 24;
const MAX_RULES_PER_TICK = 100;
const MAX_SUBJECTS_PER_RULE = 50;

function getTemplates() {
  return [
    {
      key: 'invoice_due_reminder',
      name: 'Invoice due reminder',
      description: 'Email customers before an invoice is due.',
      triggerType: 'invoice_due_in_days',
      triggerConfig: { daysBeforeDue: 2 },
      actionConfig: {
        actions: [{ type: 'send_email_platform', subject: 'Invoice due soon', body: 'Your invoice is due soon.' }]
      }
    },
    {
      key: 'low_stock_alert',
      name: 'Low-stock alert',
      description: 'Create a task when stock reaches the reorder level.',
      triggerType: 'low_stock_detected',
      triggerConfig: { thresholdMode: 'reorder_level' },
      actionConfig: {
        actions: [{ type: 'create_task', title: 'Restock low item', priority: 'high', link: '/materials' }]
      }
    },
    {
      key: 'win_back_campaign',
      name: 'Win-back campaign',
      description: 'Email customers after a period of inactivity.',
      triggerType: 'customer_inactive_days',
      triggerConfig: { inactiveDays: 30 },
      actionConfig: {
        actions: [{ type: 'send_email_platform', subject: 'We miss you', body: 'Come back for a special offer.' }]
      }
    },
    {
      key: 'birthday_greeting',
      name: 'Birthday greeting',
      description: 'Send customers a WhatsApp birthday message on their birthday.',
      triggerType: 'customer_birthday',
      triggerConfig: {},
      actionConfig: {
        actions: [{
          type: 'send_whatsapp',
          templateName: 'birthday_greeting',
          language: 'en',
          parameters: ['{{customerName}}']
        }]
      },
      reviewNote: 'Requires the birthday_greeting WhatsApp template to be approved in Meta.'
    },
    {
      key: 'overdue_invoice_reminder',
      name: 'Overdue invoice reminder',
      description: 'Send a WhatsApp payment reminder after an invoice is overdue.',
      triggerType: 'invoice_overdue',
      triggerConfig: { daysAfterDue: 1 },
      actionConfig: {
        actions: [{
          type: 'send_whatsapp',
          templateName: 'payment_reminder',
          language: 'en',
          parameters: ['{{invoiceNumber}}', '{{balance}}', '{{paymentLink}}']
        }]
      },
      reviewNote: 'Requires the payment_reminder WhatsApp template to be approved in Meta.'
    },
    {
      key: 'quote_follow_up',
      name: 'Quote follow-up',
      description: 'Email customers when a sent quote has no response.',
      triggerType: 'quote_no_response',
      triggerConfig: { silentDays: 3 },
      actionConfig: {
        actions: [{
          type: 'send_email_platform',
          subject: 'Following up on your quote',
          body: 'Hi, just checking whether you have any questions about your quote.'
        }]
      }
    },
    {
      key: 'payment_received_thank_you',
      name: 'Payment received thank-you',
      description: 'Thank customers after a payment is recorded.',
      triggerType: 'payment_received',
      disabled: true,
      unavailableReason: 'Payment-received automation triggers are not wired into the engine yet.'
    },
    {
      key: 'job_completed_notification',
      name: 'Job completed notification',
      description: 'Notify customers when a job is completed.',
      triggerType: 'job_completed',
      disabled: true,
      unavailableReason: 'Job-completed automation triggers are not wired into the automation engine yet.'
    },
    {
      key: 'daily_sales_summary',
      name: 'Daily sales summary',
      description: 'Send the team a daily sales recap.',
      triggerType: 'daily_sales_summary',
      disabled: true,
      unavailableReason: 'Daily scheduled summary triggers are not supported by automation rules yet.'
    },
    {
      key: 'review_request',
      name: 'Review request',
      description: 'Ask customers for a review after work is complete.',
      triggerType: 'review_request',
      disabled: true,
      unavailableReason: 'Review-request triggers need a completion or payment event before they can run.'
    },
    {
      key: 'low_profit_margin_alert',
      name: 'Low profit margin alert',
      description: 'Create an internal alert when a sale margin is too low.',
      triggerType: 'low_profit_margin',
      disabled: true,
      unavailableReason: 'Profit-margin trigger evaluation is not supported by the automation engine yet.'
    }
  ];
}

function normalizeActions(actionConfig) {
  if (!actionConfig) return [];
  if (Array.isArray(actionConfig.actions)) return actionConfig.actions;
  return [];
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function hasValue(value) {
  return value !== '' && value !== null && value !== undefined;
}

function compareNumber(actualValue, operator, expectedValue) {
  const actual = toNumber(actualValue, 0);
  const expected = toNumber(expectedValue, 0);
  if (operator === 'less_than') return actual < expected;
  if (operator === 'equal_to') return actual === expected;
  return actual > expected;
}

function timeToMinutes(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || ''));
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function getBooleanContextValue(triggerContext, key, fallbackKey = null) {
  if (typeof triggerContext[key] === 'boolean') return triggerContext[key];
  if (fallbackKey && typeof triggerContext[fallbackKey] === 'boolean') return triggerContext[fallbackKey];
  if (triggerContext.customer && typeof triggerContext.customer[key] === 'boolean') return triggerContext.customer[key];
  return undefined;
}

function paymentStatusForInvoice(invoice) {
  const total = toNumber(invoice.totalAmount, 0);
  const paid = toNumber(invoice.amountPaid, 0);
  const balance = toNumber(invoice.balance, Math.max(0, total - paid));
  if (String(invoice.status || '').toLowerCase() === 'overdue') return 'overdue';
  if (balance <= 0 || String(invoice.status || '').toLowerCase() === 'paid') return 'paid';
  if (paid > 0 || String(invoice.status || '').toLowerCase() === 'partial') return 'partial';
  return 'unpaid';
}

function daysBetween(start, end) {
  const startDate = startOfDay(start);
  const endDate = startOfDay(end);
  return Math.max(0, Math.floor((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)));
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function applyTemplateValues(parameters, triggerContext) {
  if (!Array.isArray(parameters)) return [];
  return parameters.map((param) => {
    if (typeof param === 'string') {
      return param.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key) => {
        const value = String(key).split('.').reduce((acc, part) => acc?.[part], triggerContext);
        return value == null ? '' : String(value);
      });
    }
    if (param && typeof param === 'object') {
      return {
        ...param,
        text: param.text != null ? applyTemplateValues([param.text], triggerContext)[0] : param.text,
        value: param.value != null ? applyTemplateValues([param.value], triggerContext)[0] : param.value
      };
    }
    return param;
  });
}

function scheduleAllowsRun(rule, now = new Date()) {
  const schedule = rule.scheduleConfig || {};
  if (schedule.pausedUntil && new Date(schedule.pausedUntil) > now) {
    return { allowed: false, reason: 'paused_until' };
  }
  if (schedule.startDate && now < new Date(schedule.startDate)) {
    return { allowed: false, reason: 'before_start_date' };
  }
  if (schedule.endDate && now > new Date(schedule.endDate)) {
    return { allowed: false, reason: 'after_end_date' };
  }
  if (Array.isArray(schedule.daysOfWeek) && schedule.daysOfWeek.length > 0) {
    const day = now.getDay();
    if (!schedule.daysOfWeek.map(Number).includes(day)) {
      return { allowed: false, reason: 'day_not_allowed' };
    }
  }
  return { allowed: true };
}

function conditionsAllowRun(rule, triggerContext, now = new Date()) {
  const conditions = rule.conditionConfig || {};
  if (conditions.weekdaysOnly === true) {
    const day = now.getDay();
    if (day === 0 || day === 6) return { allowed: false, reason: 'weekend' };
  }
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  if (conditions.runAfterTime) {
    const afterMinutes = timeToMinutes(conditions.runAfterTime);
    if (afterMinutes != null && currentMinutes < afterMinutes) return { allowed: false, reason: 'before_time_window' };
  }
  if (conditions.runBeforeTime) {
    const beforeMinutes = timeToMinutes(conditions.runBeforeTime);
    if (beforeMinutes != null && currentMinutes > beforeMinutes) return { allowed: false, reason: 'after_time_window' };
  }
  if (conditions.minInvoiceAmount != null) {
    const amount = toNumber(triggerContext.amount ?? triggerContext.balance ?? triggerContext.totalAmount, 0);
    if (amount < toNumber(conditions.minInvoiceAmount, 0)) {
      return { allowed: false, reason: 'below_min_invoice_amount' };
    }
  }
  if (conditions.maxInvoiceAmount != null) {
    const amount = toNumber(triggerContext.amount ?? triggerContext.balance ?? triggerContext.totalAmount, 0);
    if (amount > toNumber(conditions.maxInvoiceAmount, Infinity)) {
      return { allowed: false, reason: 'above_max_invoice_amount' };
    }
  }
  if (hasValue(conditions.invoiceAmountValue)) {
    const amount = triggerContext.totalAmount ?? triggerContext.invoice?.totalAmount ?? triggerContext.amount;
    if (!compareNumber(amount, conditions.invoiceAmountOperator, conditions.invoiceAmountValue)) {
      return { allowed: false, reason: 'invoice_amount_condition' };
    }
  }
  if (hasValue(conditions.balanceDueValue)) {
    const balance = triggerContext.balance ?? triggerContext.invoice?.balance ?? triggerContext.amount;
    if (!compareNumber(balance, conditions.balanceDueOperator, conditions.balanceDueValue)) {
      return { allowed: false, reason: 'balance_due_condition' };
    }
  }
  if (conditions.invoiceStatus) {
    const status = String(triggerContext.invoiceStatus ?? triggerContext.invoice?.status ?? '').toLowerCase();
    if (status !== String(conditions.invoiceStatus).toLowerCase()) return { allowed: false, reason: 'invoice_status_condition' };
  }
  if (conditions.paymentStatus) {
    const paymentStatus = String(triggerContext.paymentStatus ?? '').toLowerCase();
    if (paymentStatus !== String(conditions.paymentStatus).toLowerCase()) return { allowed: false, reason: 'payment_status_condition' };
  }
  if (hasValue(conditions.overdueDaysValue)) {
    if (!compareNumber(triggerContext.overdueDays, conditions.overdueDaysOperator, conditions.overdueDaysValue)) {
      return { allowed: false, reason: 'overdue_days_condition' };
    }
  }
  if (typeof conditions.hasOverdueInvoices === 'boolean') {
    const value = getBooleanContextValue(triggerContext, 'hasOverdueInvoices');
    if (value !== conditions.hasOverdueInvoices) return { allowed: false, reason: 'has_overdue_invoices_condition' };
  }
  if (typeof conditions.customerHasPhone === 'boolean') {
    const hasPhone = Boolean(triggerContext.phone || triggerContext.customer?.phone);
    if (hasPhone !== conditions.customerHasPhone) return { allowed: false, reason: 'customer_phone_condition' };
  }
  if (typeof conditions.customerHasEmail === 'boolean') {
    const hasEmail = Boolean(triggerContext.email || triggerContext.customer?.email);
    if (hasEmail !== conditions.customerHasEmail) return { allowed: false, reason: 'customer_email_condition' };
  }
  for (const consentKey of ['whatsappConsent', 'smsConsent', 'marketingConsent']) {
    if (typeof conditions[consentKey] === 'boolean') {
      const value = getBooleanContextValue(triggerContext, consentKey);
      if (value !== conditions[consentKey]) return { allowed: false, reason: `${consentKey}_condition` };
    }
  }
  if (hasValue(conditions.lastPurchaseOlderThanDays)) {
    const daysAgo = triggerContext.lastPurchaseDaysAgo;
    if (!hasValue(daysAgo) || toNumber(daysAgo, 0) <= toNumber(conditions.lastPurchaseOlderThanDays, 0)) {
      return { allowed: false, reason: 'last_purchase_condition' };
    }
  }
  if (hasValue(conditions.totalSpendValue)) {
    if (!compareNumber(triggerContext.totalSpend, conditions.totalSpendOperator, conditions.totalSpendValue)) {
      return { allowed: false, reason: 'total_spend_condition' };
    }
  }
  if (conditions.birthdayMatch) {
    const dob = triggerContext.dateOfBirth || triggerContext.customer?.dateOfBirth;
    if (!dob) return { allowed: false, reason: 'birthday_condition' };
    const birthday = new Date(dob);
    const sameMonth = birthday.getMonth() === now.getMonth();
    const sameDay = birthday.getDate() === now.getDate();
    if (conditions.birthdayMatch === 'today' && (!sameMonth || !sameDay)) return { allowed: false, reason: 'birthday_condition' };
    if (conditions.birthdayMatch === 'this_month' && !sameMonth) return { allowed: false, reason: 'birthday_condition' };
  }
  if (conditions.stockBelowReorderLevel === true) {
    const quantity = triggerContext.quantityOnHand ?? triggerContext.product?.quantityOnHand;
    const reorderLevel = triggerContext.reorderLevel ?? triggerContext.product?.reorderLevel;
    if (toNumber(quantity, 0) > toNumber(reorderLevel, 0)) return { allowed: false, reason: 'stock_reorder_condition' };
  }
  if (hasValue(conditions.quantityValue)) {
    const quantity = triggerContext.quantityOnHand ?? triggerContext.product?.quantityOnHand;
    if (!compareNumber(quantity, conditions.quantityOperator, conditions.quantityValue)) {
      return { allowed: false, reason: 'quantity_condition' };
    }
  }
  return { allowed: true };
}

async function isDuplicateRun({ tenantId, ruleId, subjectKey }) {
  if (!subjectKey) return false;
  const threshold = new Date(Date.now() - DEDUPE_WINDOW_HOURS * 60 * 60 * 1000);
  const existing = await AutomationRun.findOne({
    where: {
      tenantId,
      ruleId,
      createdAt: { [Op.gte]: threshold },
      triggerContext: { subjectKey }
    }
  });
  return Boolean(existing);
}

async function isCooldownRun({ tenantId, ruleId, subjectKey, cooldownHours }) {
  if (!subjectKey || !cooldownHours) return false;
  const threshold = new Date(Date.now() - cooldownHours * 60 * 60 * 1000);
  const existing = await AutomationRun.findOne({
    where: {
      tenantId,
      ruleId,
      createdAt: { [Op.gte]: threshold },
      triggerContext: { subjectKey }
    }
  });
  return Boolean(existing);
}

async function executeRule({
  rule,
  tenantId,
  triggerContext = {},
  actorUserId = null,
  options = {}
}) {
  const {
    ignoreEnabled = false,
    alwaysRecordRun = false,
    skipDedupe = false
  } = options;
  const startedAt = new Date();

  const recordSkipped = async (reason) => {
    if (!alwaysRecordRun) {
      return { skipped: true, reason };
    }
    const run = await AutomationRun.create({
      tenantId,
      ruleId: rule.id,
      status: 'skipped',
      triggerContext: { ...triggerContext, skipReason: reason },
      resultSummary: { skipped: true, reason },
      error: null,
      startedAt,
      finishedAt: new Date()
    });
    return { skipped: true, reason, runId: run.id, status: 'skipped' };
  };

  try {
    if (!rule?.enabled && !ignoreEnabled) {
      return recordSkipped('rule_disabled');
    }

    const scheduleCheck = scheduleAllowsRun(rule, startedAt);
    if (!scheduleCheck.allowed) {
      return recordSkipped(scheduleCheck.reason);
    }

    const conditionCheck = conditionsAllowRun(rule, triggerContext, startedAt);
    if (!conditionCheck.allowed) {
      return recordSkipped(conditionCheck.reason);
    }

    const subjectKey = triggerContext?.subjectKey || null;
    const cooldownHours = toNumber(rule.scheduleConfig?.cooldownHours || rule.actionConfig?.cooldownHours, 0);
    if (!skipDedupe && cooldownHours > 0 && await isCooldownRun({ tenantId, ruleId: rule.id, subjectKey, cooldownHours })) {
      return recordSkipped('cooldown_window');
    }
    if (!skipDedupe && cooldownHours <= 0 && await isDuplicateRun({ tenantId, ruleId: rule.id, subjectKey })) {
      return recordSkipped('duplicate_window');
    }

    const actions = normalizeActions(rule.actionConfig);
    const results = [];

    for (const action of actions) {
      if (action.type === 'create_task') {
        if (!actorUserId) {
          results.push({ type: 'create_task', success: false, reason: 'missing_actor' });
          continue;
        }
        const task = await UserTask.create({
          tenantId,
          userId: actorUserId,
          assigneeId: actorUserId,
          title: action.title || `Automation task: ${rule.name}`,
          description: action.description || triggerContext?.message || null,
          status: 'todo',
          priority: action.priority || 'medium',
          dueDate: action.dueDate || new Date().toISOString().slice(0, 10),
          isPrivate: false,
          sourceType: 'automation',
          sourceId: rule.id,
          sourceEvent: rule.triggerType,
          dedupeKey: `automation:${rule.id}:${subjectKey || 'none'}`,
          metadata: { automationRuleId: rule.id, link: action.link || null }
        });
        results.push({ type: 'create_task', success: true, taskId: task.id });
        continue;
      }

      if (action.type === 'send_email_platform' && triggerContext?.email) {
        const html = emailTemplates.marketingPlainMessageEmail(action.body || triggerContext.message || '', {
          name: triggerContext.businessName || 'Business'
        });
        const response = await emailService.sendPlatformMessage(
          triggerContext.email,
          action.subject || `${rule.name}`,
          html,
          action.body || triggerContext.message || ''
        );
        results.push({ type: 'send_email_platform', success: !!response?.success, error: response?.error || null });
        continue;
      }

      if (action.type === 'send_sms' && triggerContext?.phone) {
        try {
          const response = await smsService.sendMessage(tenantId, triggerContext.phone, action.body || triggerContext.message || '', action.fromNumber || null);
          results.push({ type: 'send_sms', success: !!response?.success, error: response?.error || null });
        } catch (error) {
          results.push({ type: 'send_sms', success: false, error: error?.message || 'send_failed' });
        }
        continue;
      }

      if (action.type === 'send_whatsapp' && triggerContext?.phone) {
        try {
          const response = await whatsappService.sendMessage(
            tenantId,
            triggerContext.phone,
            action.templateName || triggerContext.templateName || 'hello_world',
            applyTemplateValues(Array.isArray(action.parameters) ? action.parameters : [], triggerContext),
            action.language || 'en',
            {
              category: action.category || action.messageCategory || 'transactional',
              metadata: {
                automationRuleId: rule.id,
                triggerType: rule.triggerType,
                subjectKey
              },
              buttonParameters: Array.isArray(action.buttonParameters) ? action.buttonParameters : undefined,
              buttonIndex: action.buttonIndex
            }
          );
          results.push({ type: 'send_whatsapp', success: !!response?.success, messageId: response?.messageId || null, error: response?.error || null });
        } catch (error) {
          results.push({ type: 'send_whatsapp', success: false, error: error?.message || 'send_failed' });
        }
      }
    }

    const allSucceeded = results.length > 0 && results.every((result) => result.success !== false);
    const anyFailed = results.some((result) => result.success === false);
    const run = await AutomationRun.create({
      tenantId,
      ruleId: rule.id,
      status: anyFailed ? 'failed' : allSucceeded ? 'success' : 'skipped',
      triggerContext,
      resultSummary: { results },
      error: anyFailed ? 'One or more actions failed' : null,
      startedAt,
      finishedAt: new Date()
    });
    return { success: !anyFailed, runId: run.id, results };
  } catch (error) {
    const run = await AutomationRun.create({
      tenantId,
      ruleId: rule.id,
      status: 'failed',
      triggerContext,
      resultSummary: {},
      error: error?.message || 'execution_failed',
      startedAt,
      finishedAt: new Date()
    });
    return { success: false, runId: run.id, error: error?.message || 'execution_failed' };
  }
}

function paymentLinkForInvoice(invoice) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  return invoice.paymentToken
    ? `${frontendUrl}/pay-invoice/${invoice.paymentToken}`
    : `${frontendUrl}/invoices/${invoice.id}`;
}

function invoiceContext(invoice, rule, kind, now = new Date(), extras = {}) {
  const customer = invoice.customer || {};
  const paymentLink = paymentLinkForInvoice(invoice);
  const balance = toNumber(invoice.balance || invoice.totalAmount, 0);
  const overdueDays = invoice.dueDate && balance > 0 && new Date(invoice.dueDate) < now
    ? daysBetween(invoice.dueDate, now)
    : 0;
  return {
    subjectKey: `${kind}:${invoice.id}`,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    customerId: customer.id || invoice.customerId,
    customerName: customer.name || customer.company || 'Customer',
    email: customer.email || null,
    phone: customer.phone || null,
    amount: balance,
    balance,
    totalAmount: toNumber(invoice.totalAmount, balance),
    invoiceStatus: invoice.status || null,
    paymentStatus: paymentStatusForInvoice(invoice),
    overdueDays,
    hasOverdueInvoices: extras.hasOverdueInvoices ?? (overdueDays > 0),
    dueDate: invoice.dueDate,
    paymentLink,
    customerHasPhone: Boolean(customer.phone),
    customerHasEmail: Boolean(customer.email),
    whatsappConsent: customer.whatsappConsent === true,
    smsConsent: customer.smsConsent === true,
    marketingConsent: customer.marketingConsent === true,
    customer: {
      id: customer.id || invoice.customerId,
      name: customer.name || null,
      company: customer.company || null,
      email: customer.email || null,
      phone: customer.phone || null,
      whatsappConsent: customer.whatsappConsent === true,
      smsConsent: customer.smsConsent === true,
      marketingConsent: customer.marketingConsent === true
    },
    message: `Invoice ${invoice.invoiceNumber || invoice.id} has an outstanding balance of ${whatsappTemplates.formatCurrency(balance)}.`,
    businessName: rule.tenant?.name || 'Business'
  };
}

async function overdueInvoiceCustomerIds(tenantId, customerIds, now = new Date()) {
  const ids = [...new Set((customerIds || []).filter(Boolean))];
  if (!ids.length) return new Set();
  const rows = await Invoice.findAll({
    where: {
      tenantId,
      customerId: { [Op.in]: ids },
      status: { [Op.in]: ['sent', 'partial', 'overdue'] },
      balance: { [Op.gt]: 0 },
      dueDate: { [Op.lt]: startOfDay(now) }
    },
    attributes: ['customerId'],
    group: ['customerId'],
    raw: true
  });
  return new Set(rows.map((row) => row.customerId).filter(Boolean));
}

async function saleStatsForCustomers(tenantId, customerIds, now = new Date()) {
  const ids = [...new Set((customerIds || []).filter(Boolean))];
  if (!ids.length) return new Map();
  const rows = await Sale.findAll({
    where: { tenantId, customerId: { [Op.in]: ids } },
    attributes: [
      'customerId',
      [fn('MAX', col('createdAt')), 'lastPurchaseAt'],
      [fn('SUM', col('total')), 'totalSpend']
    ],
    group: ['customerId'],
    raw: true
  });
  return new Map(rows.map((row) => {
    const lastPurchaseAt = row.lastPurchaseAt || null;
    return [row.customerId, {
      lastPurchaseAt,
      lastPurchaseDaysAgo: lastPurchaseAt ? daysBetween(lastPurchaseAt, now) : null,
      totalSpend: toNumber(row.totalSpend, 0)
    }];
  }));
}

function customerContext(customer, rule, subjectKey, message, stats = {}) {
  return {
    subjectKey,
    customerId: customer.id,
    customerName: customer.name || customer.company || 'Customer',
    email: customer.email || null,
    phone: customer.phone || null,
    dateOfBirth: customer.dateOfBirth || null,
    customerHasPhone: Boolean(customer.phone),
    customerHasEmail: Boolean(customer.email),
    whatsappConsent: customer.whatsappConsent === true,
    smsConsent: customer.smsConsent === true,
    marketingConsent: customer.marketingConsent === true,
    lastPurchaseAt: stats.lastPurchaseAt || null,
    lastPurchaseDaysAgo: stats.lastPurchaseDaysAgo,
    totalSpend: toNumber(stats.totalSpend, 0),
    customer: {
      id: customer.id,
      name: customer.name || null,
      company: customer.company || null,
      email: customer.email || null,
      phone: customer.phone || null,
      dateOfBirth: customer.dateOfBirth || null,
      whatsappConsent: customer.whatsappConsent === true,
      smsConsent: customer.smsConsent === true,
      marketingConsent: customer.marketingConsent === true
    },
    message,
    businessName: rule.tenant?.name || 'Business'
  };
}

async function getTriggerContextsForRule(rule, now = new Date()) {
  const tenantId = rule.tenantId;
  const triggerConfig = rule.triggerConfig || {};
  const triggerType = rule.triggerType;

  if (triggerType === 'invoice_due_in_days') {
    const daysBeforeDue = toNumber(triggerConfig.daysBeforeDue, 0);
    const target = addDays(now, daysBeforeDue);
    const invoices = await Invoice.findAll({
      where: {
        tenantId,
        status: { [Op.in]: ['sent', 'partial', 'overdue'] },
        balance: { [Op.gt]: 0 },
        dueDate: { [Op.between]: [startOfDay(target), endOfDay(target)] }
      },
      include: [{ model: Customer, as: 'customer', attributes: ['id', 'name', 'company', 'phone', 'email', 'whatsappConsent', 'smsConsent', 'marketingConsent'] }],
      limit: MAX_SUBJECTS_PER_RULE,
      order: [['dueDate', 'ASC']]
    });
    const overdueCustomerIds = await overdueInvoiceCustomerIds(tenantId, invoices.map((invoice) => invoice.customerId), now);
    return invoices.map((invoice) => invoiceContext(invoice, rule, 'invoice_due', now, {
      hasOverdueInvoices: overdueCustomerIds.has(invoice.customerId)
    }));
  }

  if (triggerType === 'invoice_overdue') {
    const daysAfterDue = toNumber(triggerConfig.daysAfterDue, 0);
    const cutoff = endOfDay(addDays(now, -daysAfterDue));
    const invoices = await Invoice.findAll({
      where: {
        tenantId,
        status: { [Op.in]: ['sent', 'partial', 'overdue'] },
        balance: { [Op.gt]: 0 },
        dueDate: { [Op.lte]: cutoff }
      },
      include: [{ model: Customer, as: 'customer', attributes: ['id', 'name', 'company', 'phone', 'email', 'whatsappConsent', 'smsConsent', 'marketingConsent'] }],
      limit: MAX_SUBJECTS_PER_RULE,
      order: [['dueDate', 'ASC']]
    });
    const overdueCustomerIds = await overdueInvoiceCustomerIds(tenantId, invoices.map((invoice) => invoice.customerId), now);
    return invoices.map((invoice) => invoiceContext(invoice, rule, 'invoice_overdue', now, {
      hasOverdueInvoices: overdueCustomerIds.has(invoice.customerId)
    }));
  }

  if (triggerType === 'low_stock_detected') {
    const mode = triggerConfig.thresholdMode === 'fixed' ? 'fixed' : 'reorder_level';
    const fixedThreshold = toNumber(triggerConfig.fixedThreshold, 0);
    const products = await Product.findAll({
      where: {
        tenantId,
        isActive: true,
        trackStock: { [Op.ne]: false },
        ...(mode === 'fixed'
          ? { quantityOnHand: { [Op.lte]: fixedThreshold } }
          : { reorderLevel: { [Op.gt]: 0 } })
      },
      limit: MAX_SUBJECTS_PER_RULE,
      order: [['updatedAt', 'DESC']]
    });
    return products
      .filter((product) => mode === 'fixed' || toNumber(product.quantityOnHand, 0) <= toNumber(product.reorderLevel, 0))
      .map((product) => ({
      subjectKey: `low_stock:${product.id}`,
      productId: product.id,
      productName: product.name,
      sku: product.sku || null,
      quantityOnHand: toNumber(product.quantityOnHand, 0),
      reorderLevel: toNumber(product.reorderLevel, 0),
      product: {
        id: product.id,
        name: product.name,
        sku: product.sku || null,
        quantityOnHand: toNumber(product.quantityOnHand, 0),
        reorderLevel: toNumber(product.reorderLevel, 0),
        isActive: product.isActive !== false
      },
      message: `${product.name} is low on stock. Current stock: ${product.quantityOnHand}.`,
      businessName: rule.tenant?.name || 'Business'
    }));
  }

  if (triggerType === 'quote_no_response') {
    const silentDays = toNumber(triggerConfig.silentDays, 7);
    const cutoff = addDays(now, -silentDays);
    const quotes = await Quote.findAll({
      where: {
        tenantId,
        status: 'sent',
        updatedAt: { [Op.lte]: cutoff }
      },
      include: [{ model: Customer, as: 'customer', attributes: ['id', 'name', 'company', 'phone', 'email', 'whatsappConsent', 'smsConsent', 'marketingConsent'] }],
      limit: MAX_SUBJECTS_PER_RULE,
      order: [['updatedAt', 'ASC']]
    });
    return quotes.map((quote) => ({
      subjectKey: `quote_no_response:${quote.id}`,
      quoteId: quote.id,
      quoteNumber: quote.quoteNumber,
      customerId: quote.customer?.id || quote.customerId,
      customerName: quote.customer?.name || quote.customer?.company || 'Customer',
      email: quote.customer?.email || null,
      phone: quote.customer?.phone || null,
      amount: toNumber(quote.totalAmount, 0),
      customerHasPhone: Boolean(quote.customer?.phone),
      customerHasEmail: Boolean(quote.customer?.email),
      whatsappConsent: quote.customer?.whatsappConsent === true,
      smsConsent: quote.customer?.smsConsent === true,
      marketingConsent: quote.customer?.marketingConsent === true,
      customer: {
        id: quote.customer?.id || quote.customerId,
        name: quote.customer?.name || null,
        company: quote.customer?.company || null,
        email: quote.customer?.email || null,
        phone: quote.customer?.phone || null,
        whatsappConsent: quote.customer?.whatsappConsent === true,
        smsConsent: quote.customer?.smsConsent === true,
        marketingConsent: quote.customer?.marketingConsent === true
      },
      message: `Quote ${quote.quoteNumber || quote.id} has not received a response.`,
      businessName: rule.tenant?.name || 'Business'
    }));
  }

  if (triggerType === 'customer_inactive_days') {
    const inactiveDays = toNumber(triggerConfig.inactiveDays, 30);
    const cutoff = addDays(now, -inactiveDays);
    const activeCustomerRows = await Sale.findAll({
      where: { tenantId, createdAt: { [Op.gte]: cutoff } },
      attributes: ['customerId'],
      group: ['customerId'],
      raw: true
    });
    const activeIds = activeCustomerRows.map((row) => row.customerId).filter(Boolean);
    const customers = await Customer.findAll({
      where: {
        tenantId,
        isActive: true,
        ...(activeIds.length ? { id: { [Op.notIn]: activeIds } } : {}),
        updatedAt: { [Op.lte]: cutoff }
      },
      limit: MAX_SUBJECTS_PER_RULE,
      order: [['updatedAt', 'ASC']]
    });
    const statsByCustomer = await saleStatsForCustomers(tenantId, customers.map((customer) => customer.id), now);
    return customers.map((customer) => customerContext(
      customer,
      rule,
      `customer_inactive:${customer.id}`,
      `${customer.name || 'Customer'} has been inactive for ${inactiveDays} days.`,
      statsByCustomer.get(customer.id) || {}
    ));
  }

  if (triggerType === 'customer_birthday') {
    const monthDay = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const customers = await Customer.findAll({
      where: {
        tenantId,
        isActive: true,
        dateOfBirth: { [Op.ne]: null },
        [Op.and]: [
          sequelizeWhere(fn('to_char', col('dateOfBirth'), 'MM-DD'), monthDay)
        ]
      },
      attributes: ['id', 'name', 'company', 'phone', 'email', 'dateOfBirth', 'whatsappConsent', 'smsConsent', 'marketingConsent'],
      limit: MAX_SUBJECTS_PER_RULE,
      order: [['updatedAt', 'ASC']]
    });
    const statsByCustomer = await saleStatsForCustomers(tenantId, customers.map((customer) => customer.id), now);
    return customers.map((customer) => customerContext(
      customer,
      rule,
      `customer_birthday:${customer.id}:${now.getFullYear()}`,
      `Happy birthday, ${customer.name || 'Customer'}!`,
      statsByCustomer.get(customer.id) || {}
    ));
  }

  return [];
}

async function runDueAutomations({ now = new Date(), limit = MAX_RULES_PER_TICK } = {}) {
  const rules = await AutomationRule.findAll({
    where: { enabled: true },
    include: [{ model: Tenant, as: 'tenant', attributes: ['id', 'name'] }],
    order: [['updatedAt', 'ASC']],
    limit
  });
  const summary = { rulesChecked: rules.length, executed: 0, skipped: 0, failed: 0 };

  for (const rule of rules) {
    const scheduleCheck = scheduleAllowsRun(rule, now);
    if (!scheduleCheck.allowed) {
      summary.skipped += 1;
      continue;
    }
    let contexts = [];
    try {
      contexts = await getTriggerContextsForRule(rule, now);
    } catch (error) {
      summary.failed += 1;
      await AutomationRun.create({
        tenantId: rule.tenantId,
        ruleId: rule.id,
        status: 'failed',
        triggerContext: { scheduler: true, triggerType: rule.triggerType },
        resultSummary: {},
        error: error?.message || 'trigger_evaluation_failed',
        startedAt: now,
        finishedAt: new Date()
      });
      continue;
    }

    for (const triggerContext of contexts) {
      const result = await executeRule({
        rule,
        tenantId: rule.tenantId,
        triggerContext: { ...triggerContext, scheduler: true, triggerType: rule.triggerType },
        actorUserId: rule.createdBy || rule.updatedBy || null
      });
      if (result.skipped) summary.skipped += 1;
      else if (result.success) summary.executed += 1;
      else summary.failed += 1;
    }
  }

  return summary;
}

module.exports = {
  getTemplates,
  executeRule,
  runDueAutomations,
  scheduleAllowsRun,
  conditionsAllowRun
};
