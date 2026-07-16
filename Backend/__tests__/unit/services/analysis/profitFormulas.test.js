/**
 * Profit formula helpers for analysis (mirrors dashboard / overview COGS rules).
 */
const {
  computeAlignedProfit,
  isRetailBusinessType,
  percentChange,
} = require('../../../../services/analysis/profitFormulas');

describe('profitFormulas', () => {
  it('treats shop and pharmacy as retail', () => {
    expect(isRetailBusinessType('shop')).toBe(true);
    expect(isRetailBusinessType('pharmacy')).toBe(true);
    expect(isRetailBusinessType('printing_press')).toBe(false);
  });

  it('computes retail net profit as revenue - cogs - opex', () => {
    const r = computeAlignedProfit({
      revenue: 1000,
      operatingExpenses: 200,
      cogs: 300,
      isRetail: true,
    });
    expect(r.netProfit).toBe(500);
    expect(r.grossProfit).toBe(700);
  });

  it('ignores cogs for non-retail', () => {
    const r = computeAlignedProfit({
      revenue: 1000,
      operatingExpenses: 200,
      cogs: 300,
      isRetail: false,
    });
    expect(r.netProfit).toBe(800);
    expect(r.cogs).toBe(0);
  });

  it('computes percent change safely', () => {
    expect(percentChange(110, 100)).toBe(10);
    expect(percentChange(0, 0)).toBe(0);
    expect(percentChange(50, 0)).toBe(100);
  });
});
