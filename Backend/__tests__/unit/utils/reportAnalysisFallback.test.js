const { buildReportAnalysisFallback } = require('../../../utils/reportAnalysisFallback');

describe('buildReportAnalysisFallback', () => {
  it('returns required Smart Report analysis keys', () => {
    const analysis = buildReportAnalysisFallback(
      {
        revenue: 10000,
        expenses: 7000,
        profitMargin: 30,
        revenueChange: 5,
        expenseChange: -2,
        outstandingPayments: 500
      },
      { startDate: '2026-01-01', endDate: '2026-01-31', businessType: 'shop' }
    );

    expect(Array.isArray(analysis.keyFindings)).toBe(true);
    expect(analysis.keyFindings.length).toBeGreaterThan(0);
    expect(typeof analysis.performanceAnalysis).toBe('string');
    expect(Array.isArray(analysis.recommendations)).toBe(true);
    expect(Array.isArray(analysis.riskAssessment)).toBe(true);
    expect(Array.isArray(analysis.growthOpportunities)).toBe(true);
    expect(Array.isArray(analysis.strategicSuggestions)).toBe(true);
    expect(analysis.aiParseFallback).toBe(true);
  });
});
