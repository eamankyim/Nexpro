/**
 * Detect when the user asks about a timeframe that differs from the Ask AI period chip.
 * Prefer auto-aligning analysis to resolvable relative periods (yesterday / last week / …).
 */

const {
  normalizePeriodKey,
  rangeForPeriodKey,
  formatDateYmd,
  PERIOD_LABELS,
} = require('./metrics/dates');

const PERIOD_MENTIONS = [
  { key: 'yesterday', re: /\byesterday\b/i, spoken: 'yesterday' },
  { key: 'last_week', re: /\blast week\b/i, spoken: 'last week' },
  { key: 'last_month', re: /\blast month\b/i, spoken: 'last month' },
  { key: 'last_quarter', re: /\blast quarter\b/i, spoken: 'last quarter' },
  { key: 'today', re: /\b(today|todays)\b/i, spoken: 'today' },
  { key: 'week', re: /\b(this week|week'?s)\b/i, spoken: 'this week' },
  { key: 'month', re: /\b(this month|month'?s)\b/i, spoken: 'this month' },
  { key: 'quarter', re: /\b(this quarter|quarter'?s)\b/i, spoken: 'this quarter' },
  {
    key: 'year',
    // Allow common typo "yearr" via year+
    re: /\b(this year+|year'?s|year[- ]?to[- ]?date|\bytd\b)\b/i,
    spoken: 'this year',
  },
];

/**
 * Prefer "last X" over bare "month's" when only last is named.
 * When comparing "this X" vs "last X", prefer "this X" so compare intents
 * keep the current period as the baseline.
 * Skip "next month/week" (forecast phrasing) — those are not analysis periods.
 * @param {string} message
 * @returns {{ key: string, spoken: string } | null}
 */
function inferMentionedPeriod(message) {
  const text = String(message || '');
  if (/\bnext (month|week|quarter|year)\b/i.test(text)) {
    return null;
  }

  // Compare phrasing: "this quarter to last quarter" → keep current quarter
  const comparePairs = [
    { key: 'week', spoken: 'this week', thisRe: /\bthis week\b/i, lastRe: /\blast week\b/i },
    { key: 'month', spoken: 'this month', thisRe: /\bthis month\b/i, lastRe: /\blast month\b/i },
    { key: 'quarter', spoken: 'this quarter', thisRe: /\bthis quarter\b/i, lastRe: /\blast quarter\b/i },
    { key: 'year', spoken: 'this year', thisRe: /\bthis year+\b/i, lastRe: /\blast year\b/i },
  ];
  for (const pair of comparePairs) {
    if (pair.thisRe.test(text) && pair.lastRe.test(text)) {
      return { key: pair.key, spoken: pair.spoken };
    }
  }

  for (const entry of PERIOD_MENTIONS) {
    if (entry.re.test(text)) {
      return { key: entry.key, spoken: entry.spoken };
    }
  }
  return null;
}

/**
 * @param {string|undefined|null} periodLabel
 * @returns {string|null}
 */
function normalizePeriodLabelToKey(periodLabel) {
  const label = String(periodLabel || '').trim().toLowerCase();
  if (!label) return null;
  if (label.includes('yesterday')) return 'yesterday';
  if (label.includes('last week')) return 'last_week';
  if (label.includes('last month')) return 'last_month';
  if (label.includes('last quarter')) return 'last_quarter';
  if (label.includes('today')) return 'today';
  if (label.includes('week')) return 'week';
  if (label.includes('quarter')) return 'quarter';
  if (label.includes('year')) return 'year';
  if (label.includes('month')) return 'month';
  return normalizePeriodKey(label);
}

/**
 * Resolve a mentioned period key to concrete analysis dates.
 * @param {string} periodKey
 * @param {Date} [now]
 * @returns {{
 *   period: string,
 *   startDate: string,
 *   endDate: string,
 *   periodLabel: string,
 *   spoken: string,
 * } | null}
 */
function resolveMentionedPeriod(periodKey, now = new Date()) {
  const key = normalizePeriodKey(periodKey);
  if (!key) return null;
  const range = rangeForPeriodKey(key, now);
  if (!range) return null;
  const spoken =
    PERIOD_MENTIONS.find((e) => e.key === key)?.spoken ||
    PERIOD_LABELS[key]?.toLowerCase() ||
    key;
  return {
    period: key,
    startDate: formatDateYmd(range.start),
    endDate: formatDateYmd(range.end),
    periodLabel: range.label,
    spoken,
  };
}

/**
 * When the user named a resolvable period that differs from the chip, return
 * override dates + a short lead-in. Analysis should use the override (auto-align).
 *
 * @param {string} message
 * @param {string|undefined|null} selectedPeriodLabel
 * @param {Date} [now]
 * @returns {{
 *   override: { period: string, startDate: string, endDate: string, periodLabel: string },
 *   leadIn: string,
 * } | null}
 */
function resolvePeriodAutoAlign(message, selectedPeriodLabel, now = new Date()) {
  const mentioned = inferMentionedPeriod(message);
  if (!mentioned) return null;

  const resolved = resolveMentionedPeriod(mentioned.key, now);
  if (!resolved) return null;

  const selectedKey = normalizePeriodLabelToKey(selectedPeriodLabel);
  const selectedLabel = String(selectedPeriodLabel || '').trim() || 'the selected period';

  // Same period as chip — no override / lead-in needed
  if (selectedKey && selectedKey === mentioned.key) {
    return null;
  }

  // No chip label (or custom) — still align to mentioned dates when we can resolve them
  const leadIn = selectedKey
    ? `Using **${mentioned.spoken}** for this answer (your filter was set to **${selectedLabel}**).`
    : null;

  return {
    override: {
      period: resolved.period,
      startDate: resolved.startDate,
      endDate: resolved.endDate,
      periodLabel: resolved.periodLabel,
    },
    leadIn,
  };
}

/**
 * Legacy mismatch lead-in (kept for tests / callers that only want messaging).
 * Prefer resolvePeriodAutoAlign in the orchestrator.
 * @param {string} message
 * @param {string|undefined|null} selectedPeriodLabel
 * @returns {string|null}
 */
function buildPeriodMismatchLeadIn(message, selectedPeriodLabel) {
  const aligned = resolvePeriodAutoAlign(message, selectedPeriodLabel);
  return aligned?.leadIn || null;
}

module.exports = {
  inferMentionedPeriod,
  normalizePeriodLabelToKey,
  resolveMentionedPeriod,
  resolvePeriodAutoAlign,
  buildPeriodMismatchLeadIn,
};
