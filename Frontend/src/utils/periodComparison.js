import dayjs from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(weekOfYear);
dayjs.extend(isoWeek);

/**
 * Calculate the previous period dates based on the current filter type
 * @param {string} filterType - Current filter type (today, thisWeek, thisMonth, etc.)
 * @param {Array} currentDateRange - Current date range [startDate, endDate] as dayjs objects
 * @returns {Object} Previous period dates { start, end, label }
 */
export const getPreviousPeriod = (filterType, currentDateRange = null) => {
  const [currentStart, currentEnd] = currentDateRange || [dayjs(), dayjs()];
  const start = dayjs(currentStart);
  const end = dayjs(currentEnd);
  
  let previousStart, previousEnd, label;

  switch (filterType) {
    case 'today':
      // Compare with yesterday
      previousStart = start.subtract(1, 'day').startOf('day');
      previousEnd = previousStart.endOf('day');
      label = 'vs yesterday';
      break;

    case 'yesterday':
      // Compare with day before yesterday
      previousStart = start.subtract(1, 'day').startOf('day');
      previousEnd = previousStart.endOf('day');
      label = 'vs day before';
      break;

    case 'thisWeek':
      // Compare with last week
      previousStart = start.subtract(1, 'week').startOf('isoWeek');
      previousEnd = previousStart.endOf('isoWeek');
      label = 'vs last week';
      break;

    case 'lastWeek':
      // Compare with week before last
      previousStart = start.subtract(1, 'week').startOf('isoWeek');
      previousEnd = previousStart.endOf('isoWeek');
      label = 'vs week before';
      break;

    case 'thisMonth':
      // Compare with last month
      previousStart = start.subtract(1, 'month').startOf('month');
      previousEnd = previousStart.endOf('month');
      label = 'vs last month';
      break;

    case 'lastMonth':
      // Compare with month before last
      previousStart = start.subtract(1, 'month').startOf('month');
      previousEnd = previousStart.endOf('month');
      label = 'vs month before';
      break;

    case 'thisQuarter':
      // Compare with last quarter
      const currentQuarter = Math.floor(start.month() / 3);
      const prevQuarterStart = start.startOf('year').add((currentQuarter - 1) * 3, 'months');
      previousStart = prevQuarterStart.startOf('month');
      previousEnd = prevQuarterStart.add(2, 'months').endOf('month');
      label = 'vs last quarter';
      break;

    case 'lastQuarter':
      // Compare with quarter before last
      const lastQuarter = Math.floor(start.month() / 3);
      const prevPrevQuarterStart = start.startOf('year').add((lastQuarter - 2) * 3, 'months');
      previousStart = prevPrevQuarterStart.startOf('month');
      previousEnd = prevPrevQuarterStart.add(2, 'months').endOf('month');
      label = 'vs quarter before';
      break;

    case 'thisYear':
      // Compare with last year
      previousStart = start.subtract(1, 'year').startOf('year');
      previousEnd = previousStart.endOf('year');
      label = 'vs last year';
      break;

    case 'lastYear':
      // Compare with year before last
      previousStart = start.subtract(1, 'year').startOf('year');
      previousEnd = previousStart.endOf('year');
      label = 'vs year before';
      break;

    case 'custom':
    default:
      // For custom ranges, calculate previous period of same length
      const periodLengthDays = end.diff(start, 'day') + 1;
      previousEnd = start.subtract(1, 'day').endOf('day');
      previousStart = previousEnd.subtract(periodLengthDays - 1, 'day').startOf('day');
      label = 'vs previous period';
      break;
  }

  return {
    start: previousStart,
    end: previousEnd,
    label,
    startDate: previousStart.format('YYYY-MM-DD'),
    endDate: previousEnd.format('YYYY-MM-DD')
  };
};

/**
 * Calculate percentage change between two values
 * @param {number} current - Current period value
 * @param {number} previous - Previous period value
 * @returns {Object} { percentage, absolute, isPositive, isNegative, isNeutral }
 */
export const calculateComparison = (current, previous) => {
  const currentVal = Number(current) || 0;
  const previousVal = Number(previous) || 0;
  
  let percentage = 0;
  const absolute = currentVal - previousVal;
  
  if (previousVal > 0) {
    percentage = ((currentVal - previousVal) / previousVal) * 100;
  } else if (currentVal > 0 && previousVal <= 0) {
    percentage = 100; // Infinite growth from zero
  } else if (currentVal <= 0 && previousVal > 0) {
    percentage = -100; // Complete loss
  } else {
    percentage = 0; // Both zero
  }

  return {
    percentage: parseFloat(percentage.toFixed(2)),
    absolute: parseFloat(absolute.toFixed(2)),
    isPositive: percentage > 0,
    isNegative: percentage < 0,
    isNeutral: percentage === 0,
    current: currentVal,
    previous: previousVal
  };
};

/**
 * Format comparison text for display (no arrow; use direction for icon)
 * @param {Object} comparison - Comparison object from calculateComparison
 * @param {string} label - Period label (e.g., "vs yesterday")
 * @param {string} prefix - Value prefix (e.g., "GHS ")
 * @returns {{ direction: 'up'|'down'|'neutral', text: string }}
 */
export const formatComparisonText = (comparison, label, prefix = '') => {
  if (!comparison || typeof comparison !== 'object') {
    return { direction: 'neutral', text: '' };
  }
  const { percentage, absolute, isPositive, isNeutral } = comparison;
  const direction = isNeutral ? 'neutral' : (isPositive ? 'up' : 'down');
  const sign = isPositive ? '+' : '';
  let text;
  if (prefix) {
    text = `${sign}${percentage}% ${label} (${prefix}${Math.abs(absolute).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
  } else {
    text = `${sign}${percentage}% ${label} (${Math.abs(absolute)})`;
  }
  return { direction, text };
};
