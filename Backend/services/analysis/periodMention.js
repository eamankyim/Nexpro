/**
 * Detect when the user asks about a timeframe that differs from the Ask AI period chip.
 */

const PERIOD_MENTIONS = [
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
 * @param {string} message
 * @returns {{ key: string, spoken: string } | null}
 */
function inferMentionedPeriod(message) {
  const text = String(message || '');
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
  if (label.includes('today')) return 'today';
  if (label.includes('week')) return 'week';
  if (label.includes('month')) return 'month';
  if (label.includes('quarter')) return 'quarter';
  if (label.includes('year')) return 'year';
  return null;
}

/**
 * Lead-in when the user named a different period than the selected chip.
 * @param {string} message
 * @param {string|undefined|null} selectedPeriodLabel
 * @returns {string|null}
 */
function buildPeriodMismatchLeadIn(message, selectedPeriodLabel) {
  const mentioned = inferMentionedPeriod(message);
  const selectedKey = normalizePeriodLabelToKey(selectedPeriodLabel);
  const selectedLabel = String(selectedPeriodLabel || '').trim() || 'the selected period';
  if (!mentioned || !selectedKey || mentioned.key === selectedKey) {
    return null;
  }

  const switchLabel =
    mentioned.key === 'year'
      ? 'This year'
      : mentioned.key === 'quarter'
        ? 'This quarter'
        : mentioned.key === 'month'
          ? 'This month'
          : mentioned.key === 'week'
            ? 'This week'
            : 'Today';

  return [
    `I don't have **${mentioned.spoken}** numbers loaded right now because your filter is set to **${selectedLabel}**.`,
    `Here's what I can see for **${selectedLabel}** — switch the filter to **${switchLabel}** if you want ${mentioned.spoken} figures.`,
  ].join(' ');
}

module.exports = {
  inferMentionedPeriod,
  normalizePeriodLabelToKey,
  buildPeriodMismatchLeadIn,
};
