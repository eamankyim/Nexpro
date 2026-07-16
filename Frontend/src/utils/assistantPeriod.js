import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';

dayjs.extend(isoWeek);
dayjs.extend(quarterOfYear);

/** Ask AI period chips — keys align with analysis API `period`. */
export const ASSISTANT_PERIOD_OPTIONS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'quarter', label: 'This quarter' },
  { key: 'year', label: 'This year' },
];

/**
 * Map period chip key to Dashboard-aligned date range (ISO week, calendar quarter).
 * @param {'today'|'week'|'month'|'quarter'|'year'} periodKey
 * @param {import('dayjs').Dayjs} [now]
 * @returns {{ period: string, startDate: string, endDate: string, periodLabel: string }}
 */
export function resolveAssistantPeriod(periodKey = 'today', now = dayjs()) {
  const key = ASSISTANT_PERIOD_OPTIONS.some((o) => o.key === periodKey) ? periodKey : 'today';
  let start;
  let end;
  switch (key) {
    case 'week':
      start = now.startOf('isoWeek');
      end = now.endOf('isoWeek');
      break;
    case 'month':
      start = now.startOf('month');
      end = now.endOf('month');
      break;
    case 'quarter':
      start = now.startOf('quarter');
      end = now.endOf('quarter');
      break;
    case 'year':
      start = now.startOf('year');
      end = now.endOf('year');
      break;
    case 'today':
    default:
      start = now.startOf('day');
      end = now.endOf('day');
      break;
  }
  const option = ASSISTANT_PERIOD_OPTIONS.find((o) => o.key === key);
  return {
    period: key,
    startDate: start.format('YYYY-MM-DD'),
    endDate: end.format('YYYY-MM-DD'),
    periodLabel: option?.label || 'Today',
  };
}

/**
 * Infer chip key from URL/dashboard dates when possible; default Today.
 * @param {string|undefined} startDate
 * @param {string|undefined} endDate
 * @param {string|undefined} periodLabel
 * @returns {'today'|'week'|'month'|'quarter'|'year'}
 */
export function inferAssistantPeriodKey(startDate, endDate, periodLabel) {
  const label = String(periodLabel || '').toLowerCase();
  if (label.includes('week')) return 'week';
  if (label.includes('quarter')) return 'quarter';
  if (label.includes('year')) return 'year';
  if (label.includes('month')) return 'month';
  if (label.includes('today') || label === 'today') return 'today';

  if (startDate && endDate) {
    const start = dayjs(startDate);
    const end = dayjs(endDate);
    if (start.isSame(end, 'day') && start.isSame(dayjs(), 'day')) return 'today';
    const week = resolveAssistantPeriod('week');
    if (startDate === week.startDate && endDate === week.endDate) return 'week';
    const month = resolveAssistantPeriod('month');
    if (startDate === month.startDate && endDate === month.endDate) return 'month';
    const quarter = resolveAssistantPeriod('quarter');
    if (startDate === quarter.startDate && endDate === quarter.endDate) return 'quarter';
    const year = resolveAssistantPeriod('year');
    if (startDate === year.startDate && endDate === year.endDate) return 'year';
  }
  return 'today';
}
