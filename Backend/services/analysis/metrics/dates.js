/**
 * Date-range helpers for analysis metrics.
 * Aligns with Dashboard presets (ISO week Mon–Sun, calendar quarter/year).
 * Uses local calendar days (Ghana / Africa/Accra is GMT+0 — matches typical server UTC day bounds).
 */

const PERIOD_KEYS = ['today', 'week', 'month', 'quarter', 'year'];

const PERIOD_LABELS = {
  today: 'Today',
  week: 'This week',
  month: 'This month',
  quarter: 'This quarter',
  year: 'This year',
};

/**
 * @param {string|undefined} period
 * @returns {'today'|'week'|'month'|'quarter'|'year'|null}
 */
function normalizePeriodKey(period) {
  if (!period || typeof period !== 'string') return null;
  const raw = period.trim().toLowerCase();
  const aliases = {
    today: 'today',
    day: 'today',
    week: 'week',
    thisweek: 'week',
    'this_week': 'week',
    'this-week': 'week',
    month: 'month',
    thismonth: 'month',
    'this_month': 'month',
    'this-month': 'month',
    quarter: 'quarter',
    thisquarter: 'quarter',
    'this_quarter': 'quarter',
    'this-quarter': 'quarter',
    year: 'year',
    thisyear: 'year',
    'this_year': 'year',
    'this-year': 'year',
  };
  const key = aliases[raw.replace(/\s+/g, '')] || aliases[raw] || (PERIOD_KEYS.includes(raw) ? raw : null);
  return key;
}

/**
 * @param {Date} d
 * @returns {string} YYYY-MM-DD
 */
function formatDateYmd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * @param {Date} [now]
 * @returns {{ start: Date, end: Date, label: string }}
 */
function getTodayRange(now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { start, end, label: PERIOD_LABELS.today };
}

/**
 * ISO week: Monday–Sunday (matches Dashboard dayjs startOf('isoWeek')).
 * @param {Date} [now]
 * @returns {{ start: Date, end: Date, label: string }}
 */
function getThisWeekRange(now = new Date()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 Sun … 6 Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(d);
  start.setDate(d.getDate() + diffToMonday);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end, label: PERIOD_LABELS.week };
}

/**
 * @param {Date} [now]
 * @returns {{ start: Date, end: Date, label: string }}
 */
function getThisMonthRange(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end, label: PERIOD_LABELS.month };
}

/**
 * Calendar quarter (Q1=Jan–Mar, …) — matches Dashboard.
 * @param {Date} [now]
 * @returns {{ start: Date, end: Date, label: string }}
 */
function getThisQuarterRange(now = new Date()) {
  const qStartMonth = Math.floor(now.getMonth() / 3) * 3;
  const start = new Date(now.getFullYear(), qStartMonth, 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now.getFullYear(), qStartMonth + 3, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end, label: PERIOD_LABELS.quarter };
}

/**
 * @param {Date} [now]
 * @returns {{ start: Date, end: Date, label: string }}
 */
function getThisYearRange(now = new Date()) {
  const start = new Date(now.getFullYear(), 0, 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now.getFullYear(), 11, 31);
  end.setHours(23, 59, 59, 999);
  return { start, end, label: PERIOD_LABELS.year };
}

/**
 * Inclusive calendar-day count between two dates.
 * @param {Date} start
 * @param {Date} end
 * @returns {number}
 */
function countInclusiveDays(start, end) {
  const s = new Date(start);
  s.setHours(0, 0, 0, 0);
  const e = new Date(end);
  e.setHours(0, 0, 0, 0);
  const ms = e.getTime() - s.getTime();
  if (!Number.isFinite(ms) || ms < 0) return 1;
  return Math.max(1, Math.round(ms / (24 * 60 * 60 * 1000)) + 1);
}

/**
 * Prior period of equal length immediately before `start`.
 * @param {Date} start
 * @param {Date} end
 * @returns {{ start: Date, end: Date, label: string, dayCount: number }}
 */
function getEqualLengthPriorPeriod(start, end) {
  const dayCount = countInclusiveDays(start, end);
  const priorEnd = new Date(start);
  priorEnd.setDate(priorEnd.getDate() - 1);
  priorEnd.setHours(23, 59, 59, 999);
  const priorStart = new Date(priorEnd);
  priorStart.setDate(priorStart.getDate() - (dayCount - 1));
  priorStart.setHours(0, 0, 0, 0);
  return {
    start: priorStart,
    end: priorEnd,
    label: 'Prior period',
    dayCount,
  };
}

/**
 * Parse optional YYYY-MM-DD range from request options.
 * @param {string|undefined} startDate
 * @param {string|undefined} endDate
 * @param {string|undefined} periodLabel
 * @returns {{ start: Date, end: Date, label: string } | null}
 */
function parseSelectedPeriod(startDate, endDate, periodLabel) {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return {
    start,
    end,
    label: periodLabel || 'Selected period',
  };
}

/**
 * Resolve Ask AI period chip / explicit dates to a concrete range.
 * Preference: explicit start/end → period key → defaultToday (or defaultMonth).
 *
 * Date-filter semantics:
 * - Sales / performance / top products / why-down: filter transactions by this range.
 * - Receivables / who-owes: point-in-time outstanding (ignore range for balances);
 *   still return label so the UI can say "As of today…".
 *
 * @param {{
 *   period?: string,
 *   startDate?: string,
 *   endDate?: string,
 *   periodLabel?: string,
 *   defaultPeriod?: 'today'|'month',
 * }} options
 * @param {Date} [now]
 * @returns {{
 *   start: Date,
 *   end: Date,
 *   label: string,
 *   periodKey: string,
 *   startDate: string,
 *   endDate: string,
 * }}
 */
function resolveAnalysisPeriod(options = {}, now = new Date()) {
  const explicit = parseSelectedPeriod(options.startDate, options.endDate, options.periodLabel);
  if (explicit) {
    const key = normalizePeriodKey(options.period) || 'custom';
    return {
      ...explicit,
      periodKey: key,
      startDate: formatDateYmd(explicit.start),
      endDate: formatDateYmd(explicit.end),
    };
  }

  const key =
    normalizePeriodKey(options.period) ||
    (options.defaultPeriod === 'month' ? 'month' : 'today');

  let range;
  switch (key) {
    case 'week':
      range = getThisWeekRange(now);
      break;
    case 'month':
      range = getThisMonthRange(now);
      break;
    case 'quarter':
      range = getThisQuarterRange(now);
      break;
    case 'year':
      range = getThisYearRange(now);
      break;
    case 'today':
    default:
      range = getTodayRange(now);
      break;
  }

  return {
    ...range,
    periodKey: key === 'today' || key === 'week' || key === 'month' || key === 'quarter' || key === 'year'
      ? key
      : 'today',
    startDate: formatDateYmd(range.start),
    endDate: formatDateYmd(range.end),
  };
}

module.exports = {
  PERIOD_KEYS,
  PERIOD_LABELS,
  normalizePeriodKey,
  formatDateYmd,
  getTodayRange,
  getThisWeekRange,
  getThisMonthRange,
  getThisQuarterRange,
  getThisYearRange,
  countInclusiveDays,
  getEqualLengthPriorPeriod,
  parseSelectedPeriod,
  resolveAnalysisPeriod,
};
