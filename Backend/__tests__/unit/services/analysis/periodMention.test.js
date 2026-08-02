const {
  inferMentionedPeriod,
  normalizePeriodLabelToKey,
  buildPeriodMismatchLeadIn,
} = require('../../../../services/analysis/periodMention');

describe('periodMention', () => {
  it('detects this year including typo yearr', () => {
    expect(inferMentionedPeriod('based on this yearr sales')?.key).toBe('year');
    expect(inferMentionedPeriod('sales this year')?.key).toBe('year');
  });

  it('maps selected filter labels', () => {
    expect(normalizePeriodLabelToKey('This quarter')).toBe('quarter');
    expect(normalizePeriodLabelToKey('This year')).toBe('year');
  });

  it('builds a lead-in when asked year while filter is quarter', () => {
    const lead = buildPeriodMismatchLeadIn(
      'What do I need to work on based on this year sales?',
      'This quarter'
    );
    expect(lead).toMatch(/this year/i);
    expect(lead).toMatch(/This quarter/);
    expect(lead).toMatch(/This year/);
  });

  it('returns null when periods match', () => {
    expect(
      buildPeriodMismatchLeadIn('How are sales this quarter?', 'This quarter')
    ).toBeNull();
  });
});
