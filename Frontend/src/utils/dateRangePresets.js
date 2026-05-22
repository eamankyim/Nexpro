import dayjs from 'dayjs';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(quarterOfYear);
dayjs.extend(weekOfYear);
dayjs.extend(isoWeek);

/**
 * Calculate a date range from a preset filter key.
 * @param {string} filterType - Preset key (today, thisQuarter, etc.)
 * @param {import('dayjs').Dayjs|null} [customDate] - Reference date (defaults to now)
 * @param {{ specificMonth?: string, specificYear?: string|number }} [options]
 * @returns {[import('dayjs').Dayjs, import('dayjs').Dayjs]}
 */
export const calculateDateRange = (filterType, customDate = null, options = {}) => {
  const date = customDate || dayjs();
  let startDate;
  let endDate;

  switch (filterType) {
    case 'today':
      startDate = date.startOf('day');
      endDate = date.endOf('day');
      break;
    case 'yesterday':
      startDate = date.subtract(1, 'day').startOf('day');
      endDate = date.subtract(1, 'day').endOf('day');
      break;
    case 'thisWeek':
      startDate = date.startOf('isoWeek');
      endDate = date.endOf('isoWeek');
      break;
    case 'lastWeek':
      startDate = date.subtract(1, 'week').startOf('isoWeek');
      endDate = date.subtract(1, 'week').endOf('isoWeek');
      break;
    case 'thisMonth':
      startDate = date.startOf('month');
      endDate = date.endOf('month');
      break;
    case 'lastMonth':
      startDate = date.subtract(1, 'month').startOf('month');
      endDate = date.subtract(1, 'month').endOf('month');
      break;
    case 'thisQuarter':
      startDate = date.startOf('quarter');
      endDate = date.endOf('quarter');
      break;
    case 'lastQuarter':
      startDate = date.subtract(1, 'quarter').startOf('quarter');
      endDate = date.subtract(1, 'quarter').endOf('quarter');
      break;
    case 'thisYear':
      startDate = date.startOf('year');
      endDate = date.endOf('year');
      break;
    case 'specificMonth': {
      const parsedMonth = dayjs(options.specificMonth, 'YYYY-MM', true);
      const monthDate = parsedMonth.isValid() ? parsedMonth : date;
      startDate = monthDate.startOf('month');
      endDate = monthDate.endOf('month');
      break;
    }
    case 'specificYear': {
      const parsedYear = Number.parseInt(options.specificYear, 10);
      const yearDate = Number.isFinite(parsedYear) ? dayjs().year(parsedYear) : date;
      startDate = yearDate.startOf('year');
      endDate = yearDate.endOf('year');
      break;
    }
    case 'lastYear':
      startDate = date.subtract(1, 'year').startOf('year');
      endDate = date.subtract(1, 'year').endOf('year');
      break;
    case 'custom':
      startDate = date.startOf('day');
      endDate = date.endOf('day');
      break;
    default:
      startDate = date.startOf('month');
      endDate = date.endOf('month');
  }

  return [startDate, endDate];
};

/**
 * Chart grouping granularity for a preset filter.
 * @param {string} filterType
 * @param {[import('dayjs').Dayjs, import('dayjs').Dayjs]|null} [dateRange]
 * @returns {'hour'|'day'|'week'|'month'}
 */
export const getGroupByForFilter = (filterType, dateRange = null) => {
  switch (filterType) {
    case 'today':
    case 'yesterday':
      return 'hour';
    case 'thisWeek':
    case 'lastWeek':
      return 'day';
    case 'thisMonth':
    case 'lastMonth':
    case 'specificMonth':
      return 'week';
    case 'thisQuarter':
    case 'lastQuarter':
      return 'month';
    case 'thisYear':
    case 'lastYear':
    case 'specificYear':
      return 'month';
    case 'custom': {
      if (!dateRange?.[0] || !dateRange?.[1]) return 'day';
      const daysDiff = dateRange[1].diff(dateRange[0], 'day');
      if (daysDiff <= 1) return 'hour';
      if (daysDiff <= 7) return 'day';
      if (daysDiff <= 31) return 'week';
      return 'month';
    }
    default:
      return 'day';
  }
};

/** Preset keys shown in the overview date picker. */
export const DATE_FILTER_PRESET_KEYS = [
  'today',
  'yesterday',
  'thisWeek',
  'lastWeek',
  'thisMonth',
  'lastMonth',
  'thisQuarter',
  'lastQuarter',
  'thisYear',
  'lastYear',
];
