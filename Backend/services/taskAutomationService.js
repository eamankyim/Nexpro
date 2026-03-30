const { Op } = require('sequelize');
const { Quote, Setting, UserTask, UserTenant } = require('../models');
const { normalizeTaskAutomation } = require('../utils/taskAutomationConfig');

const OPEN_TASK_STATUSES = ['todo', 'in_progress', 'on_hold'];

async function getTaskAutomationConfig(tenantId) {
  const org = await Setting.findOne({ where: { tenantId, key: 'organization' } });
  return normalizeTaskAutomation(org?.value?.taskAutomation || {});
}

async function resolveActorUserId(tenantId, preferredUserId = null) {
  if (preferredUserId) return preferredUserId;
  const ownerOrManager = await UserTenant.findOne({
    where: {
      tenantId,
      status: 'active',
      role: { [Op.in]: ['owner', 'admin', 'manager'] }
    },
    attributes: ['userId'],
    order: [['createdAt', 'ASC']]
  });
  return ownerOrManager?.userId || null;
}

async function createOrUpsertAutomatedTask({
  tenantId,
  title,
  description,
  dueDate = null,
  assigneeId = null,
  priority = 'medium',
  sourceType,
  sourceId,
  sourceEvent,
  actorUserId = null,
  link = null
}) {
  if (!tenantId || !title || !sourceType || !sourceId || !sourceEvent) return null;
  const dedupeKey = `${sourceType}:${sourceId}:${sourceEvent}`;
  const actorId = await resolveActorUserId(tenantId, actorUserId || assigneeId);
  if (!actorId) return null;

  const existing = await UserTask.findOne({
    where: {
      tenantId,
      dedupeKey,
      status: { [Op.in]: OPEN_TASK_STATUSES }
    },
    order: [['updatedAt', 'DESC']]
  });

  const payload = {
    tenantId,
    userId: actorId,
    title,
    status: existing?.status || 'todo',
    dueDate: dueDate || null,
    priority,
    description: description || null,
    assigneeId: assigneeId || actorId,
    isPrivate: false,
    sourceType,
    sourceId: String(sourceId),
    sourceEvent,
    dedupeKey,
    metadata: {
      automation: true,
      link: link || null
    }
  };

  if (existing) {
    await existing.update(payload);
    return existing;
  }

  return UserTask.create(payload);
}

async function createLeadFollowUpTask({ lead, followUpDate, nextStep, tenantId, triggeredBy }) {
  const cfg = await getTaskAutomationConfig(tenantId);
  if (!cfg.leadFollowUpToTask || !lead?.id || !followUpDate) return null;
  return createOrUpsertAutomatedTask({
    tenantId,
    title: `Lead follow-up: ${lead.name || lead.company || 'Lead'}`,
    description: nextStep || `Follow up with lead ${lead.name || lead.company || ''}`.trim(),
    dueDate: new Date(followUpDate).toISOString().slice(0, 10),
    assigneeId: lead.assignedTo || lead.createdBy || triggeredBy || null,
    priority: lead.priority || 'medium',
    sourceType: 'lead',
    sourceId: lead.id,
    sourceEvent: 'follow_up',
    actorUserId: triggeredBy || lead.createdBy || null,
    link: `/leads/${lead.id}`
  });
}

async function createInvoiceOverdueTask({ invoice, tenantId, triggeredBy }) {
  const cfg = await getTaskAutomationConfig(tenantId);
  if (!cfg.invoiceOverdueToTask || !invoice?.id) return null;
  return createOrUpsertAutomatedTask({
    tenantId,
    title: `Collect overdue invoice ${invoice.invoiceNumber || ''}`.trim(),
    description: `Invoice ${invoice.invoiceNumber || invoice.id} is overdue. Follow up for payment collection.`,
    dueDate: new Date().toISOString().slice(0, 10),
    assigneeId: null,
    priority: 'high',
    sourceType: 'invoice',
    sourceId: invoice.id,
    sourceEvent: 'overdue_follow_up',
    actorUserId: triggeredBy || null,
    link: '/invoices'
  });
}

async function createLowStockTask({ item, tenantId, triggeredBy }) {
  const cfg = await getTaskAutomationConfig(tenantId);
  if (!cfg.lowStockToTask || !item?.id) return null;
  return createOrUpsertAutomatedTask({
    tenantId,
    title: `Restock: ${item.name || 'Item'}`,
    description: `${item.name || 'Item'} is low on stock (${item.quantityOnHand ?? item.currentStock ?? 0} left, reorder at ${item.reorderLevel ?? 0}).`,
    dueDate: new Date().toISOString().slice(0, 10),
    assigneeId: null,
    priority: 'high',
    sourceType: 'stock',
    sourceId: item.id,
    sourceEvent: 'low_stock_restock',
    actorUserId: triggeredBy || null,
    link: '/materials'
  });
}

async function runQuoteNoResponseScan() {
  const orgSettings = await Setting.findAll({
    where: { key: 'organization' },
    attributes: ['tenantId', 'value']
  });

  let createdOrUpdated = 0;
  const now = new Date();

  for (const row of orgSettings) {
    if (!row.tenantId) continue;
    const cfg = normalizeTaskAutomation(row.value?.taskAutomation || {});
    if (!cfg.quoteNoResponseToTask) continue;

    const thresholdDate = new Date(now.getTime() - cfg.quoteNoResponseDays * 24 * 60 * 60 * 1000);
    const staleQuotes = await Quote.findAll({
      where: {
        tenantId: row.tenantId,
        status: 'sent',
        createdAt: { [Op.lte]: thresholdDate }
      },
      attributes: ['id', 'quoteNumber', 'title', 'createdBy', 'createdAt']
    });

    for (const quote of staleQuotes) {
      const task = await createOrUpsertAutomatedTask({
        tenantId: row.tenantId,
        title: `Quote follow-up: ${quote.quoteNumber || quote.title || 'Quote'}`,
        description: `No response yet for quote ${quote.quoteNumber || quote.id}. Follow up with customer.`,
        dueDate: new Date().toISOString().slice(0, 10),
        assigneeId: quote.createdBy || null,
        priority: 'medium',
        sourceType: 'quote',
        sourceId: quote.id,
        sourceEvent: 'no_response_follow_up',
        actorUserId: quote.createdBy || null,
        link: '/quotes'
      });
      if (task) createdOrUpdated += 1;
    }
  }

  return { createdOrUpdated };
}

module.exports = {
  getTaskAutomationConfig,
  createLeadFollowUpTask,
  createInvoiceOverdueTask,
  createLowStockTask,
  runQuoteNoResponseScan
};
