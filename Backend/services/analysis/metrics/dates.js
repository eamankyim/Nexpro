/**
 * Date-range helpers for analysis metrics.
 */

/**
 * @param {Date} [now]
 * @returns {{ start: Date, end: Date, label: string }}
 */
function getTodayRange(now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { start, end, label: 'Today' };
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
  return { start, end, label: 'This month' };
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

module.exports = {
  getTodayRange,
  getThisMonthRange,
  countInclusiveDays,
  getEqualLengthPriorPeriod,
  parseSelectedPeriod,
};
