const {
  inferMentionedPeriod,
  normalizePeriodLabelToKey,
  buildPeriodMismatchLeadIn,
  resolvePeriodAutoAlign,
  resolveMentionedPeriod,
} = require('../../../../services/analysis/periodMention');

describe('periodMention', () => {
  const now = new Date('2026-07-16T12:00:00');

  it('detects this year including typo yearr', () => {
    expect(inferMentionedPeriod('based on this yearr sales')?.key).toBe('year');
    expect(inferMentionedPeriod('sales this year')?.key).toBe('year');
  });

  it('detects yesterday / last week / last month', () => {
    expect(inferMentionedPeriod('sales yesterday')?.key).toBe('yesterday');
    expect(inferMentionedPeriod('How did last week go?')?.key).toBe('last_week');
    expect(inferMentionedPeriod('revenue last month')?.key).toBe('last_month');
  });

  it('prefers this quarter when comparing this vs last quarter', () => {
    expect(inferMentionedPeriod('Compare this quarter to last quarter')?.key).toBe(
      'quarter'
    );
  });

  it('does not treat next month as an analysis period mention', () => {
    expect(inferMentionedPeriod("Predict next month's revenue")).toBeNull();
  });

  it('maps selected filter labels', () => {
    expect(normalizePeriodLabelToKey('This quarter')).toBe('quarter');
    expect(normalizePeriodLabelToKey('This year')).toBe('year');
    expect(normalizePeriodLabelToKey('Yesterday')).toBe('yesterday');
    expect(normalizePeriodLabelToKey('Last week')).toBe('last_week');
  });

  it('auto-aligns when asked year while filter is quarter', () => {
    const aligned = resolvePeriodAutoAlign(
      'What do I need to work on based on this year sales?',
      'This quarter',
      now
    );
    expect(aligned).not.toBeNull();
    expect(aligned.override.period).toBe('year');
    expect(aligned.override.startDate).toBe('2026-01-01');
    expect(aligned.override.endDate).toBe('2026-12-31');
    expect(aligned.leadIn).toMatch(/this year/i);
    expect(aligned.leadIn).toMatch(/This quarter/);
  });

  it('builds a lead-in when periods differ', () => {
    const lead = buildPeriodMismatchLeadIn(
      'What do I need to work on based on this year sales?',
      'This quarter'
    );
    expect(lead).toMatch(/this year/i);
    expect(lead).toMatch(/This quarter/);
  });

  it('returns null when periods match', () => {
    expect(
      buildPeriodMismatchLeadIn('How are sales this quarter?', 'This quarter')
    ).toBeNull();
    expect(
      resolvePeriodAutoAlign('How are sales this quarter?', 'This quarter', now)
    ).toBeNull();
  });

  it('resolves yesterday dates', () => {
    const r = resolveMentionedPeriod('yesterday', now);
    expect(r.startDate).toBe('2026-07-15');
    expect(r.endDate).toBe('2026-07-15');
    expect(r.periodLabel).toBe('Yesterday');
  });
});
