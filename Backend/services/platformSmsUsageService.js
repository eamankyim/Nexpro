const { sequelize } = require('../config/database');
const { getSavedPlatformSmsConfig, parseMonthlyLimit } = require('./platformSmsSettingsService');

const ACCRA_TIMEZONE = 'Africa/Accra';

const isMissingUsageTableError = (error) => {
  const code = error?.parent?.code || error?.original?.code;
  const message = String(error?.message || error?.parent?.message || '');
  return code === '42P01' || /relation ["']?tenant_platform_sms_usage["']? does not exist/i.test(message);
};

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

/**
 * First moment of the next calendar month in Africa/Accra (UTC+0).
 * @returns {string} ISO 8601 timestamp
 */
function getNextResetAt() {
  const yearMonth = getCurrentYearMonth();
  const [year, month] = yearMonth.split('-').map((value) => parseInt(value, 10));
  let nextYear = year;
  let nextMonth = month + 1;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear += 1;
  }
  const pad = (value) => String(value).padStart(2, '0');
  return `${nextYear}-${pad(nextMonth)}-01T00:00:00.000Z`;
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

  let sentCount = 0;
  try {
    const [rows] = await sequelize.query(
      `
        SELECT sent_count AS "sentCount"
        FROM tenant_platform_sms_usage
        WHERE tenant_id = :tenantId AND year_month = :yearMonth
        LIMIT 1
      `,
      { replacements: { tenantId, yearMonth } }
    );
    sentCount = parseInt(rows?.[0]?.sentCount, 10) || 0;
  } catch (error) {
    if (!isMissingUsageTableError(error)) throw error;
  }
  const remaining = Math.max(0, monthlyLimit - sentCount);

  return {
    yearMonth,
    sentCount,
    monthlyLimit,
    remaining,
    resetsAt: getNextResetAt(),
  };
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
  getNextResetAt,
  getMonthlyLimit,
  getTenantUsageSummary,
  checkPlatformSmsLimit,
  incrementPlatformSmsUsage,
};
