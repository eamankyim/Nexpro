/**
 * Compute previous period dates for dashboard comparison
 * Mirrors frontend periodComparison logic
 */
const getPreviousPeriodDates = (filterType, startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  let prevStart;
  let prevEnd;
  let label;

  const addDays = (d, n) => {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  };
  const startOfDay = (d) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };
  const endOfDay = (d) => {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
  };
  const startOfWeek = (d) => {
    const x = new Date(d);
    const day = x.getDay();
    const diff = x.getDate() - day + (day === 0 ? -6 : 1);
    x.setDate(diff);
    x.setHours(0, 0, 0, 0);
    return x;
  };
  const endOfWeek = (d) => {
    const x = startOfWeek(d);
    x.setDate(x.getDate() + 6);
    x.setHours(23, 59, 59, 999);
    return x;
  };
  const startOfMonth = (d) => {
    const x = new Date(d);
    x.setDate(1);
    x.setHours(0, 0, 0, 0);
    return x;
  };
  const endOfMonth = (d) => {
    const x = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    x.setHours(23, 59, 59, 999);
    return x;
  };

  switch (filterType) {
    case 'today':
      prevStart = addDays(start, -1);
      prevEnd = endOfDay(prevStart);
      label = 'vs yesterday';
      break;
    case 'yesterday':
      prevStart = addDays(start, -1);
      prevEnd = endOfDay(prevStart);
      label = 'vs day before';
      break;
    case 'thisWeek':
    case 'week':
      prevStart = addDays(startOfWeek(start), -7);
      prevEnd = endOfWeek(prevStart);
      label = 'vs last week';
      break;
    case 'lastWeek':
      prevStart = addDays(startOfWeek(start), -14);
      prevEnd = endOfWeek(prevStart);
      label = 'vs week before';
      break;
    case 'thisMonth':
    case 'month':
      prevStart = new Date(start.getFullYear(), start.getMonth() - 1, 1);
      prevEnd = endOfMonth(prevStart);
      label = 'vs last month';
      break;
    case 'lastMonth':
      prevStart = new Date(start.getFullYear(), start.getMonth() - 2, 1);
      prevEnd = endOfMonth(prevStart);
      label = 'vs month before';
      break;
    case 'thisQuarter': {
      const q = Math.floor(start.getMonth() / 3);
      prevStart = new Date(start.getFullYear(), (q - 1) * 3, 1);
      prevEnd = endOfMonth(new Date(start.getFullYear(), (q - 1) * 3 + 2, 1));
      label = 'vs last quarter';
      break;
    }
    case 'thisYear':
      prevStart = new Date(start.getFullYear() - 1, 0, 1);
      prevEnd = new Date(start.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
      label = 'vs last year';
      break;
    case 'custom':
    default: {
      const days = Math.round((end - start) / (24 * 60 * 60 * 1000)) + 1;
      prevEnd = addDays(start, -1);
      prevEnd.setHours(23, 59, 59, 999);
      prevStart = addDays(prevEnd, -days + 1);
      prevStart.setHours(0, 0, 0, 0);
      label = 'vs previous period';
      break;
    }
  }

  if (!prevStart || !prevEnd) return null;
  return {
    startDate: prevStart.toISOString().slice(0, 10),
    endDate: prevEnd.toISOString().slice(0, 10),
    start: prevStart,
    end: prevEnd,
    label,
  };
};

const calculateComparison = (current, previous) => {
  const currentVal = Number(current) || 0;
  const previousVal = Number(previous) || 0;
  let percentage = 0;
  const absolute = currentVal - previousVal;
  if (previousVal > 0) {
    percentage = ((currentVal - previousVal) / previousVal) * 100;
  } else if (currentVal > 0 && previousVal <= 0) {
    percentage = 100;
  } else if (currentVal <= 0 && previousVal > 0) {
    percentage = -100;
  }
  return {
    percentage: parseFloat(percentage.toFixed(2)),
    absolute: parseFloat(absolute.toFixed(2)),
    isPositive: percentage > 0,
    isNegative: percentage < 0,
    isNeutral: percentage === 0,
    current: currentVal,
    previous: previousVal,
  };
};

module.exports = { getPreviousPeriodDates, calculateComparison };
