const { sequelize } = require('../config/database');
const { getSavedPlatformSmsConfig, parseMonthlyLimit } = require('./platformSmsSettingsService');

const ACCRA_TIMEZONE = 'Africa/Accra';

/**
 * Current YYYY-MM in Africa/Accra (month resets at Accra local midnight).
 * @returns {string}
 */
function getCurrentYearMonth() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: ACCRA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
  });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  return `${year}-${month}`;
}

async function getMonthlyLimit() {
  const config = await getSavedPlatformSmsConfig();
  if (config?.monthlyLimit) return config.monthlyLimit;

  const { Setting } = require('../models');
  const setting = await Setting.findOne({
    where: { tenantId: null, key: 'platform:sms' },
  });
  return parseMonthlyLimit(setting?.value?.monthlyLimit);
}

/**
 * @param {string} tenantId
 * @returns {Promise<{ yearMonth: string, sentCount: number, monthlyLimit: number, remaining: number }>}
 */
async function getTenantUsageSummary(tenantId) {
  const yearMonth = getCurrentYearMonth();
  const monthlyLimit = await getMonthlyLimit();

  const [rows] = await sequelize.query(
    `
      SELECT sent_count AS "sentCount"
      FROM tenant_platform_sms_usage
      WHERE tenant_id = :tenantId AND year_month = :yearMonth
      LIMIT 1
    `,
    { replacements: { tenantId, yearMonth } }
  );

  const sentCount = parseInt(rows?.[0]?.sentCount, 10) || 0;
  const remaining = Math.max(0, monthlyLimit - sentCount);

  return { yearMonth, sentCount, monthlyLimit, remaining };
}

/**
 * @param {string} tenantId
 * @param {number} [count=1]
 * @returns {Promise<{ allowed: boolean, errorCode?: string, error?: string, summary: object }>}
 */
async function checkPlatformSmsLimit(tenantId, count = 1) {
  const summary = await getTenantUsageSummary(tenantId);
  const requested = Math.max(1, parseInt(count, 10) || 1);

  if (summary.sentCount + requested > summary.monthlyLimit) {
    return {
      allowed: false,
      errorCode: 'PLATFORM_SMS_MONTHLY_LIMIT',
      error: `Platform SMS monthly limit reached (${summary.monthlyLimit}/month). Used ${summary.sentCount}, requested ${requested}.`,
      summary,
    };
  }

  return { allowed: true, summary };
}

/**
 * Atomically increment usage after a successful platform SMS send.
 * @param {string} tenantId
 * @param {number} [count=1]
 * @returns {Promise<number>} New sent_count for the month
 */
async function incrementPlatformSmsUsage(tenantId, count = 1) {
  const yearMonth = getCurrentYearMonth();
  const incrementBy = Math.max(1, parseInt(count, 10) || 1);

  const [rows] = await sequelize.query(
    `
      INSERT INTO tenant_platform_sms_usage (tenant_id, year_month, sent_count, "createdAt", "updatedAt")
      VALUES (:tenantId, :yearMonth, :incrementBy, NOW(), NOW())
      ON CONFLICT (tenant_id, year_month)
      DO UPDATE SET
        sent_count = tenant_platform_sms_usage.sent_count + :incrementBy,
        "updatedAt" = NOW()
      RETURNING sent_count AS "sentCount"
    `,
    { replacements: { tenantId, yearMonth, incrementBy } }
  );

  return parseInt(rows?.[0]?.sentCount, 10) || incrementBy;
}

module.exports = {
  ACCRA_TIMEZONE,
  getCurrentYearMonth,
  getMonthlyLimit,
  getTenantUsageSummary,
  checkPlatformSmsLimit,
  incrementPlatformSmsUsage,
};
