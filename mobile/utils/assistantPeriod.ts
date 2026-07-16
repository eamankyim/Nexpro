/**
 * Ask AI period chips — keys align with analysis API `period`.
 * Uses local calendar days (ISO week Mon–Sun), matching Dashboard / backend.
 */

export const ASSISTANT_PERIOD_OPTIONS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'quarter', label: 'This quarter' },
  { key: 'year', label: 'This year' },
] as const;

export type AssistantPeriodKey = (typeof ASSISTANT_PERIOD_OPTIONS)[number]['key'];

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function formatYmd(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/**
 * Map period chip key to Dashboard-aligned date range.
 */
export function resolveAssistantPeriod(
  periodKey: AssistantPeriodKey | string = 'today',
  now = new Date()
): { period: AssistantPeriodKey; startDate: string; endDate: string; periodLabel: string } {
  const key = (ASSISTANT_PERIOD_OPTIONS.some((o) => o.key === periodKey)
    ? periodKey
    : 'today') as AssistantPeriodKey;

  let start: Date;
  let end: Date;

  switch (key) {
    case 'week': {
      const d = startOfDay(now);
      const day = d.getDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;
      start = startOfDay(d);
      start.setDate(d.getDate() + diffToMonday);
      end = endOfDay(start);
      end.setDate(start.getDate() + 6);
      break;
    }
    case 'month': {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      start = startOfDay(start);
      end = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
      break;
    }
    case 'quarter': {
      const qStart = Math.floor(now.getMonth() / 3) * 3;
      start = startOfDay(new Date(now.getFullYear(), qStart, 1));
      end = endOfDay(new Date(now.getFullYear(), qStart + 3, 0));
      break;
    }
    case 'year': {
      start = startOfDay(new Date(now.getFullYear(), 0, 1));
      end = endOfDay(new Date(now.getFullYear(), 11, 31));
      break;
    }
    case 'today':
    default:
      start = startOfDay(now);
      end = endOfDay(now);
      break;
  }

  const option = ASSISTANT_PERIOD_OPTIONS.find((o) => o.key === key);
  return {
    period: key,
    startDate: formatYmd(start),
    endDate: formatYmd(end),
    periodLabel: option?.label || 'Today',
  };
}
