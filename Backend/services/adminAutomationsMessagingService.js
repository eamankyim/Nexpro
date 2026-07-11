const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { AutomationRun } = require('../models');
const {
  getCurrentYearMonth,
  getNextResetAt,
  getMonthlyLimit,
} = require('./platformSmsUsageService');
const { testPlatformSmsConnection } = require('./platformSmsSettingsService');

const DEFAULT_PERIOD_DAYS = 30;
const MESSAGING_ACTION_TYPES = ['send_sms', 'send_email_platform', 'send_whatsapp'];
const CHANNEL_BY_ACTION = {
  send_sms: 'sms',
  send_email_platform: 'email',
  send_whatsapp: 'whatsapp',
};

const isMissingUsageTableError = (error) => {
  const code = error?.parent?.code || error?.original?.code;
  const message = String(error?.message || error?.parent?.message || '');
  return code === '42P01' || /relation ["']?tenant_platform_sms_usage["']? does not exist/i.test(message);
};

/**
 * Parse ISO date or return null.
 * @param {string|Date|null|undefined} value
 * @returns {Date|null}
 */
function parseIsoDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Resolve period bounds. Defaults to last 30 days ending now.
 * @param {{ from?: string, to?: string, defaultDays?: number }} options
 * @returns {{ from: Date, to: Date }}
 */
function resolvePeriodBounds({ from, to, defaultDays = DEFAULT_PERIOD_DAYS } = {}) {
  const toDate = parseIsoDate(to) || new Date();
  let fromDate = parseIsoDate(from);
  if (!fromDate) {
    fromDate = new Date(toDate);
    fromDate.setDate(fromDate.getDate() - defaultDays);
  }
  return { from: fromDate, to: toDate };
}

/**
 * Derive observability status without exposing rule configs.
 * @param {boolean} enabled
 * @param {string|null|undefined} lastRunStatus
 * @returns {'paused'|'failed'|'active'|'waiting'}
 */
function deriveRuleStatus(enabled, lastRunStatus) {
  if (!enabled) return 'paused';
  if (!lastRunStatus) return 'waiting';
  if (String(lastRunStatus).toLowerCase() === 'failed') return 'failed';
  return 'active';
}

/**
 * Count successful messaging actions in a resultSummary.results array.
 * @param {Array<{ type?: string, success?: boolean }>|null|undefined} results
 * @returns {{ sms: number, email: number, whatsapp: number }}
 */
function countSuccessfulChannelActions(results) {
  const counts = { sms: 0, email: 0, whatsapp: 0 };
  if (!Array.isArray(results)) return counts;
  for (const action of results) {
    if (!action || action.success !== true) continue;
    const channel = CHANNEL_BY_ACTION[action.type];
    if (channel) counts[channel] += 1;
  }
  return counts;
}

/**
 * Aggregate channel success counts across runs (in-memory helper for tests / small sets).
 * @param {Array<{ resultSummary?: { results?: Array } }>} runs
 * @returns {{ sms: number, email: number, whatsapp: number }}
 */
function aggregateChannelCountsFromRuns(runs) {
  return (runs || []).reduce(
    (acc, run) => {
      const next = countSuccessfulChannelActions(run?.resultSummary?.results);
      acc.sms += next.sms;
      acc.email += next.email;
      acc.whatsapp += next.whatsapp;
      return acc;
    },
    { sms: 0, email: 0, whatsapp: 0 }
  );
}

/**
 * @param {number} sentCount
 * @param {number} monthlyLimit
 * @returns {{ sentCount: number, monthlyLimit: number, remaining: number, percentUsed: number }}
 */
function computeSmsUsageMetrics(sentCount, monthlyLimit) {
  const sent = Math.max(0, parseInt(sentCount, 10) || 0);
  const limit = Math.max(0, parseInt(monthlyLimit, 10) || 0);
  const remaining = Math.max(0, limit - sent);
  const percentUsed = limit > 0 ? Math.min(100, Math.round((sent / limit) * 100)) : 0;
  return { sentCount: sent, monthlyLimit: limit, remaining, percentUsed };
}

/**
 * SQL aggregate of successful messaging actions in period.
 * @param {{ from: Date, to: Date, tenantId?: string }} options
 * @returns {Promise<{ sms: number, email: number, whatsapp: number }>}
 */
async function getChannelCountsFromRuns({ from, to, tenantId } = {}) {
  const replacements = { from, to };
  let tenantClause = '';
  if (tenantId) {
    tenantClause = 'AND ar."tenantId" = :tenantId';
    replacements.tenantId = tenantId;
  }

  try {
    const [rows] = await sequelize.query(
      `
        SELECT elem->>'type' AS "actionType", COUNT(*)::int AS count
        FROM automation_runs ar
        CROSS JOIN LATERAL jsonb_array_elements(
          COALESCE(ar."resultSummary"->'results', '[]'::jsonb)
        ) AS elem
        WHERE ar."createdAt" BETWEEN :from AND :to
          ${tenantClause}
          AND elem->>'type' IN ('send_sms', 'send_email_platform', 'send_whatsapp')
          AND (elem->>'success') = 'true'
        GROUP BY elem->>'type'
      `,
      { replacements }
    );

    const counts = { sms: 0, email: 0, whatsapp: 0 };
    for (const row of rows || []) {
      const channel = CHANNEL_BY_ACTION[row.actionType];
      if (channel) counts[channel] = parseInt(row.count, 10) || 0;
    }
    return counts;
  } catch (error) {
    // Table may be missing in fresh envs
    if (error?.parent?.code === '42P01' || /automation_runs/i.test(String(error?.message || ''))) {
      return { sms: 0, email: 0, whatsapp: 0 };
    }
    throw error;
  }
}

/**
 * Run status KPIs for a period.
 * @param {{ from: Date, to: Date, tenantId?: string }} options
 */
async function getRunKpis({ from, to, tenantId } = {}) {
  const where = {
    createdAt: { [Op.between]: [from, to] },
  };
  if (tenantId) where.tenantId = tenantId;

  const [total, success, failed, skipped] = await Promise.all([
    AutomationRun.count({ where }),
    AutomationRun.count({ where: { ...where, status: 'success' } }),
    AutomationRun.count({ where: { ...where, status: 'failed' } }),
    AutomationRun.count({ where: { ...where, status: 'skipped' } }),
  ]);

  return { total, success, failed, skipped };
}

/**
 * Rule KPIs across tenants (failing = enabled + latest run failed).
 * @param {{ tenantId?: string }} options
 */
async function getRuleKpis({ tenantId } = {}) {
  const replacements = {};
  let tenantClause = '';
  if (tenantId) {
    tenantClause = 'AND r."tenantId" = :tenantId';
    replacements.tenantId = tenantId;
  }

  const [[totals]] = await sequelize.query(
    `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE r.enabled = true)::int AS enabled
      FROM automation_rules r
      WHERE 1=1 ${tenantClause}
    `,
    { replacements }
  );

  const [[failingRow]] = await sequelize.query(
    `
      SELECT COUNT(*)::int AS failing
      FROM automation_rules r
      WHERE r.enabled = true
        ${tenantClause}
        AND (
          SELECT ar.status
          FROM automation_runs ar
          WHERE ar."ruleId" = r.id
          ORDER BY ar."createdAt" DESC
          LIMIT 1
        ) = 'failed'
    `,
    { replacements }
  );

  return {
    total: parseInt(totals?.total, 10) || 0,
    enabled: parseInt(totals?.enabled, 10) || 0,
    failing: parseInt(failingRow?.failing, 10) || 0,
  };
}

/**
 * Platform SMS usage rows for a calendar month (Africa/Accra yearMonth).
 * @param {{ yearMonth?: string }} options
 */
async function getPlatformSmsUsageByTenant({ yearMonth } = {}) {
  const month = yearMonth || getCurrentYearMonth();
  const monthlyLimit = await getMonthlyLimit();

  let rows = [];
  try {
    const [usageRows] = await sequelize.query(
      `
        SELECT
          u.tenant_id AS "tenantId",
          t.name AS "tenantName",
          u.sent_count AS "sentCount"
        FROM tenant_platform_sms_usage u
        LEFT JOIN tenants t ON t.id = u.tenant_id
        WHERE u.year_month = :yearMonth
        ORDER BY u.sent_count DESC, t.name ASC NULLS LAST
      `,
      { replacements: { yearMonth: month } }
    );
    rows = usageRows || [];
  } catch (error) {
    if (!isMissingUsageTableError(error)) throw error;
  }

  const byTenant = rows.map((row) => {
    const metrics = computeSmsUsageMetrics(row.sentCount, monthlyLimit);
    return {
      tenantId: row.tenantId,
      tenantName: row.tenantName || 'Unknown tenant',
      yearMonth: month,
      ...metrics,
    };
  });

  const sentTotal = byTenant.reduce((sum, row) => sum + row.sentCount, 0);
  const remainingTotal = byTenant.reduce((sum, row) => sum + row.remaining, 0);

  return {
    yearMonth: month,
    monthlyLimit,
    resetsAt: getNextResetAt(),
    totals: {
      sentCount: sentTotal,
      remaining: remainingTotal,
      tenantCount: byTenant.length,
    },
    byTenant,
  };
}

/**
 * Sanitize Arkesel balance payload — no secrets.
 * @param {object|null} data
 */
function sanitizeBalancePayload(data) {
  if (!data || typeof data !== 'object') return null;
  return {
    smsBalance: data.sms_balance ?? data.smsBalance ?? data.balance ?? null,
    mainBalance: data.main_balance ?? data.mainBalance ?? null,
    currency: data.currency || null,
    raw: {
      sms_balance: data.sms_balance ?? data.smsBalance ?? null,
      main_balance: data.main_balance ?? data.mainBalance ?? null,
    },
  };
}

/**
 * Optional Arkesel balance refresh using saved platform SMS settings.
 * @param {{ userId?: string, requestId?: string }} meta
 */
async function fetchArkeselBalance(meta = {}) {
  try {
    const result = await testPlatformSmsConnection({
      payload: {},
      userId: meta.userId,
      requestId: meta.requestId,
    });
    return {
      ok: true,
      provider: result.provider || 'arkesel',
      message: result.message,
      balance: sanitizeBalancePayload(result.data),
    };
  } catch (error) {
    return {
      ok: false,
      provider: 'arkesel',
      message: error.message || 'Failed to fetch Arkesel balance',
      balance: null,
    };
  }
}

/**
 * Paginated cross-tenant automation rules (privacy-safe fields only).
 * @param {object} options
 */
async function listAutomationsOverview({
  from,
  to,
  status,
  tenantId,
  q,
  page = 1,
  limit = 20,
} = {}) {
  const period = resolvePeriodBounds({ from, to });
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (safePage - 1) * safeLimit;

  const replacements = {
    from: period.from,
    to: period.to,
    limit: safeLimit,
    offset,
  };

  const whereParts = ['1=1'];
  if (tenantId) {
    whereParts.push('r."tenantId" = :tenantId');
    replacements.tenantId = tenantId;
  }
  if (q) {
    whereParts.push('(r.name ILIKE :q OR t.name ILIKE :q)');
    replacements.q = `%${String(q).trim()}%`;
  }

  // derivedStatus filter applied after join of last run
  let statusClause = '';
  if (status === 'paused') {
    statusClause = 'AND r.enabled = false';
  } else if (status === 'waiting') {
    statusClause = 'AND r.enabled = true AND lr."lastRunAt" IS NULL';
  } else if (status === 'failed') {
    statusClause = `AND r.enabled = true AND lr."lastRunStatus" = 'failed'`;
  } else if (status === 'active') {
    statusClause = `AND r.enabled = true AND lr."lastRunAt" IS NOT NULL AND lr."lastRunStatus" IS DISTINCT FROM 'failed'`;
  } else if (status === 'enabled') {
    statusClause = 'AND r.enabled = true';
  } else if (status === 'disabled') {
    statusClause = 'AND r.enabled = false';
  }

  const whereSql = whereParts.join(' AND ');

  const baseFrom = `
    FROM automation_rules r
    INNER JOIN tenants t ON t.id = r."tenantId"
    LEFT JOIN LATERAL (
      SELECT
        COALESCE(ar."finishedAt", ar."createdAt") AS "lastRunAt",
        ar.status AS "lastRunStatus"
      FROM automation_runs ar
      WHERE ar."ruleId" = r.id
      ORDER BY ar."createdAt" DESC
      LIMIT 1
    ) lr ON true
    LEFT JOIN (
      SELECT
        ar."ruleId",
        COUNT(*)::int AS "runsTotal",
        COUNT(*) FILTER (WHERE ar.status = 'failed')::int AS "runsFailed"
      FROM automation_runs ar
      WHERE ar."createdAt" BETWEEN :from AND :to
      GROUP BY ar."ruleId"
    ) stats ON stats."ruleId" = r.id
    WHERE ${whereSql}
    ${statusClause}
  `;

  const [[countRow]] = await sequelize.query(
    `SELECT COUNT(*)::int AS total ${baseFrom}`,
    { replacements }
  );

  const [rows] = await sequelize.query(
    `
      SELECT
        r.id,
        r.name,
        r."tenantId",
        t.name AS "tenantName",
        r."triggerType",
        r.enabled,
        lr."lastRunAt",
        lr."lastRunStatus",
        COALESCE(stats."runsTotal", 0)::int AS "runsTotal",
        COALESCE(stats."runsFailed", 0)::int AS "runsFailed",
        r."updatedAt"
      ${baseFrom}
      ORDER BY r."updatedAt" DESC
      LIMIT :limit OFFSET :offset
    `,
    { replacements }
  );

  const automations = (rows || []).map((row) => ({
    id: row.id,
    tenantId: row.tenantId,
    tenantName: row.tenantName,
    name: row.name,
    triggerType: row.triggerType,
    enabled: Boolean(row.enabled),
    derivedStatus: deriveRuleStatus(row.enabled, row.lastRunStatus),
    lastRunAt: row.lastRunAt || null,
    lastRunStatus: row.lastRunStatus || null,
    runsTotal: parseInt(row.runsTotal, 10) || 0,
    runsFailed: parseInt(row.runsFailed, 10) || 0,
  }));

  const total = parseInt(countRow?.total, 10) || 0;

  return {
    period: {
      from: period.from.toISOString(),
      to: period.to.toISOString(),
    },
    automations,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit) || 0,
    },
  };
}

/**
 * Full admin overview payload.
 */
async function getAutomationsMessagingOverview(query = {}) {
  const period = resolvePeriodBounds({ from: query.from, to: query.to });
  const tenantId = query.tenantId || undefined;

  const [rules, runs, channels, list, platformSms] = await Promise.all([
    getRuleKpis({ tenantId }),
    getRunKpis({ from: period.from, to: period.to, tenantId }),
    getChannelCountsFromRuns({ from: period.from, to: period.to, tenantId }),
    listAutomationsOverview({
      from: period.from.toISOString(),
      to: period.to.toISOString(),
      status: query.status,
      tenantId,
      q: query.q,
      page: query.page,
      limit: query.limit,
    }),
    getPlatformSmsUsageByTenant({ yearMonth: getCurrentYearMonth() }),
  ]);

  return {
    period: list.period,
    kpis: {
      rules,
      runs,
      messaging: channels,
      platformSms: {
        yearMonth: platformSms.yearMonth,
        sentCount: platformSms.totals.sentCount,
        remaining: platformSms.totals.remaining,
        monthlyLimitPerTenant: platformSms.monthlyLimit,
        tenantCount: platformSms.totals.tenantCount,
        resetsAt: platformSms.resetsAt,
      },
    },
    automations: list.automations,
    pagination: list.pagination,
  };
}

/**
 * Messaging usage endpoint payload.
 */
async function getMessagingUsage(query = {}, meta = {}) {
  const period = resolvePeriodBounds({ from: query.from, to: query.to });
  const yearMonth = query.yearMonth || getCurrentYearMonth();
  const includeBalance = query.includeBalance === '1'
    || query.includeBalance === 'true'
    || query.includeBalance === true;

  const [platformSms, channels, balance] = await Promise.all([
    getPlatformSmsUsageByTenant({ yearMonth }),
    getChannelCountsFromRuns({ from: period.from, to: period.to }),
    includeBalance ? fetchArkeselBalance(meta) : Promise.resolve(null),
  ]);

  return {
    yearMonth: platformSms.yearMonth,
    period: {
      from: period.from.toISOString(),
      to: period.to.toISOString(),
    },
    platformSms,
    channels,
    balance,
  };
}

module.exports = {
  DEFAULT_PERIOD_DAYS,
  MESSAGING_ACTION_TYPES,
  CHANNEL_BY_ACTION,
  parseIsoDate,
  resolvePeriodBounds,
  deriveRuleStatus,
  countSuccessfulChannelActions,
  aggregateChannelCountsFromRuns,
  computeSmsUsageMetrics,
  getChannelCountsFromRuns,
  getRunKpis,
  getRuleKpis,
  getPlatformSmsUsageByTenant,
  sanitizeBalancePayload,
  fetchArkeselBalance,
  listAutomationsOverview,
  getAutomationsMessagingOverview,
  getMessagingUsage,
};
