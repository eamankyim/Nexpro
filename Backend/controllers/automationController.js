const { AutomationRule, AutomationRun } = require('../models');
const { getTemplates, executeRule } = require('../services/automationEngineService');

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).toLowerCase();
  return normalized === 'true' || normalized === '1';
}

exports.getTemplates = async (_req, res, next) => {
  try {
    res.status(200).json({ success: true, data: getTemplates() });
  } catch (error) {
    next(error);
  }
};

exports.listRules = async (req, res, next) => {
  try {
    const enabledOnly = parseBoolean(req.query.enabledOnly, false);
    const where = { tenantId: req.tenantId };
    if (enabledOnly) where.enabled = true;
    const rows = await AutomationRule.findAll({ where, order: [['updatedAt', 'DESC']] });
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

exports.createRule = async (req, res, next) => {
  try {
    const {
      name,
      triggerType,
      triggerConfig = {},
      conditionConfig = {},
      actionConfig = {},
      scheduleConfig = {},
      enabled = true,
      metadata = {}
    } = req.body || {};
    if (!name || !triggerType) {
      return res.status(400).json({ success: false, error: 'name and triggerType are required' });
    }
    const created = await AutomationRule.create({
      tenantId: req.tenantId,
      name: String(name).trim(),
      triggerType: String(triggerType).trim(),
      triggerConfig,
      conditionConfig,
      actionConfig,
      scheduleConfig,
      enabled: parseBoolean(enabled, true),
      metadata,
      createdBy: req.user?.id || null,
      updatedBy: req.user?.id || null
    });
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    next(error);
  }
};

exports.updateRule = async (req, res, next) => {
  try {
    const rule = await AutomationRule.findOne({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!rule) {
      return res.status(404).json({ success: false, error: 'Rule not found' });
    }
    const allowedFields = ['name', 'triggerType', 'triggerConfig', 'conditionConfig', 'actionConfig', 'scheduleConfig', 'enabled', 'metadata'];
    for (const key of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) {
        rule[key] = key === 'enabled' ? parseBoolean(req.body[key], rule.enabled) : req.body[key];
      }
    }
    rule.updatedBy = req.user?.id || null;
    await rule.save();
    res.status(200).json({ success: true, data: rule });
  } catch (error) {
    next(error);
  }
};

exports.toggleRule = async (req, res, next) => {
  try {
    const rule = await AutomationRule.findOne({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!rule) {
      return res.status(404).json({ success: false, error: 'Rule not found' });
    }
    rule.enabled = !rule.enabled;
    rule.updatedBy = req.user?.id || null;
    await rule.save();
    res.status(200).json({ success: true, data: rule });
  } catch (error) {
    next(error);
  }
};

exports.listRuns = async (req, res, next) => {
  try {
    const where = { tenantId: req.tenantId };
    if (req.query.ruleId) where.ruleId = req.query.ruleId;
    const rows = await AutomationRun.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: Math.min(200, Number(req.query.limit || 50))
    });
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

exports.testRule = async (req, res, next) => {
  try {
    const rule = await AutomationRule.findOne({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!rule) {
      return res.status(404).json({ success: false, error: 'Rule not found' });
    }
    const triggerContext = req.body?.triggerContext || {};
    const result = await executeRule({
      rule,
      tenantId: req.tenantId,
      triggerContext,
      actorUserId: req.user?.id || null
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
