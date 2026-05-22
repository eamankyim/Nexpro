import dayjs from 'dayjs';

const PRESET_LABELS = {
  today: 'Today',
  yesterday: 'Yesterday',
  thisWeek: 'This week',
  lastWeek: 'Last week',
  thisMonth: 'This month',
  lastMonth: 'Last month',
  thisQuarter: 'This quarter',
  lastQuarter: 'Last quarter',
  thisYear: 'This year',
  lastYear: 'Last year',
  custom: 'Selected period',
  week: 'This week',
  month: 'This month',
  quarter: 'This quarter',
  year: 'This year',
};

/**
 * Human-readable label for a report/dashboard date filter.
 * @param {string} [dateFilter] - Preset key (today, thisMonth, custom, etc.)
 * @param {[import('dayjs').Dayjs, import('dayjs').Dayjs]|null} [dateRange]
 * @returns {string}
 */
export function formatPeriodLabel(dateFilter, dateRange = null) {
  if (dateFilter && dateFilter !== 'custom' && PRESET_LABELS[dateFilter]) {
    return PRESET_LABELS[dateFilter];
  }
  if (dateRange?.[0] && dateRange?.[1]) {
    const start = dayjs(dateRange[0]);
    const end = dayjs(dateRange[1]);
    if (start.isSame(end, 'day')) {
      return start.format('D MMM YYYY');
    }
    return `${start.format('D MMM YYYY')} – ${end.format('D MMM YYYY')}`;
  }
  return PRESET_LABELS.custom;
}

/**
 * Short comparison subtitle for KPI cards.
 * @param {string} [comparisonLabel]
 * @returns {string}
 */
export function formatComparisonSubtitle(comparisonLabel) {
  return comparisonLabel || 'vs previous period';
}
