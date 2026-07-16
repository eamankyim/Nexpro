const {
  resolveAnalysisPeriod,
  getThisWeekRange,
  getThisQuarterRange,
  getThisYearRange,
  normalizePeriodKey,
} = require('../../../../services/analysis/metrics/dates');

describe('analysis dates / resolveAnalysisPeriod', () => {
  const now = new Date('2026-07-16T12:00:00'); // Thursday

  it('defaults to today', () => {
    const r = resolveAnalysisPeriod({}, now);
    expect(r.periodKey).toBe('today');
    expect(r.label).toBe('Today');
    expect(r.startDate).toBe('2026-07-16');
    expect(r.endDate).toBe('2026-07-16');
  });

  it('resolves ISO week Mon–Sun', () => {
    const r = resolveAnalysisPeriod({ period: 'week' }, now);
    expect(r.periodKey).toBe('week');
    expect(r.startDate).toBe('2026-07-13');
    expect(r.endDate).toBe('2026-07-19');
    expect(getThisWeekRange(now).label).toBe('This week');
  });

  it('resolves quarter and year', () => {
    expect(resolveAnalysisPeriod({ period: 'quarter' }, now).startDate).toBe('2026-07-01');
    expect(resolveAnalysisPeriod({ period: 'quarter' }, now).endDate).toBe('2026-09-30');
    expect(getThisQuarterRange(now).label).toBe('This quarter');
    expect(resolveAnalysisPeriod({ period: 'year' }, now).startDate).toBe('2026-01-01');
    expect(getThisYearRange(now).end).toBeDefined();
    expect(resolveAnalysisPeriod({ period: 'year' }, now).endDate).toBe('2026-12-31');
  });

  it('prefers explicit start/end over period key', () => {
    const r = resolveAnalysisPeriod(
      {
        period: 'year',
        startDate: '2026-03-01',
        endDate: '2026-03-15',
        periodLabel: 'Custom sprint',
      },
      now
    );
    expect(r.startDate).toBe('2026-03-01');
    expect(r.endDate).toBe('2026-03-15');
    expect(r.label).toBe('Custom sprint');
  });

  it('normalizes period aliases', () => {
    expect(normalizePeriodKey('this_week')).toBe('week');
    expect(normalizePeriodKey('This Month')).toBe('month');
  });
});
