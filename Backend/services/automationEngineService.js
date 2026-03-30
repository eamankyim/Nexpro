const { Op } = require('sequelize');
const { AutomationRun, UserTask } = require('../models');
const emailService = require('./emailService');
const smsService = require('./smsService');
const whatsappService = require('./whatsappService');
const emailTemplates = require('./emailTemplates');

const DEDUPE_WINDOW_HOURS = 24;

function getTemplates() {
  return [
    {
      key: 'invoice_due_reminder',
      name: 'Invoice due reminder',
      triggerType: 'invoice_due_in_days',
      triggerConfig: { daysBeforeDue: 2 },
      actionConfig: {
        actions: [{ type: 'send_email_platform', subject: 'Invoice due soon', body: 'Your invoice is due soon.' }]
      }
    },
    {
      key: 'low_stock_alert',
      name: 'Low-stock alert',
      triggerType: 'low_stock_detected',
      triggerConfig: { thresholdMode: 'reorder_level' },
      actionConfig: {
        actions: [{ type: 'create_task', title: 'Restock low item', priority: 'high', link: '/materials' }]
      }
    },
    {
      key: 'win_back_campaign',
      name: 'Win-back campaign',
      triggerType: 'customer_inactive_days',
      triggerConfig: { inactiveDays: 30 },
      actionConfig: {
        actions: [{ type: 'send_email_platform', subject: 'We miss you', body: 'Come back for a special offer.' }]
      }
    }
  ];
}

function normalizeActions(actionConfig) {
  if (!actionConfig) return [];
  if (Array.isArray(actionConfig.actions)) return actionConfig.actions;
  return [];
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

async function executeRule({ rule, tenantId, triggerContext = {}, actorUserId = null }) {
  const startedAt = new Date();
  try {
    if (!rule?.enabled) {
      return { skipped: true, reason: 'rule_disabled' };
    }

    const subjectKey = triggerContext?.subjectKey || null;
    if (await isDuplicateRun({ tenantId, ruleId: rule.id, subjectKey })) {
      return { skipped: true, reason: 'duplicate_window' };
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
          await smsService.sendMessage(triggerContext.phone, action.body || triggerContext.message || '', { tenantId });
          results.push({ type: 'send_sms', success: true });
        } catch (error) {
          results.push({ type: 'send_sms', success: false, error: error?.message || 'send_failed' });
        }
        continue;
      }

      if (action.type === 'send_whatsapp' && triggerContext?.phone) {
        try {
          await whatsappService.sendTemplateMessage({
            tenantId,
            to: triggerContext.phone,
            templateName: action.templateName,
            language: action.language || 'en',
            parameters: Array.isArray(action.parameters) ? action.parameters : []
          });
          results.push({ type: 'send_whatsapp', success: true });
        } catch (error) {
          results.push({ type: 'send_whatsapp', success: false, error: error?.message || 'send_failed' });
        }
      }
    }

    const run = await AutomationRun.create({
      tenantId,
      ruleId: rule.id,
      status: 'success',
      triggerContext,
      resultSummary: { results },
      startedAt,
      finishedAt: new Date()
    });
    return { success: true, runId: run.id, results };
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

module.exports = {
  getTemplates,
  executeRule
};
