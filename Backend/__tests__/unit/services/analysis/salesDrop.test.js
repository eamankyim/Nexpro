const { buildSalesDropReasons } = require('../../../../services/analysis/reasons/salesDrop');

describe('buildSalesDropReasons', () => {
  const prior = {
    revenue: 10000,
    saleCount: 100,
    aov: 100,
    dayCount: 30,
    revenuePerDay: 333.33,
    expenses: 2000,
  };

  it('reports not_down when revenue rose', () => {
    const result = buildSalesDropReasons({
      current: { ...prior, revenue: 12000, revenuePerDay: 400 },
      prior,
    });
    expect(result.isDown).toBe(false);
    expect(result.reasons[0].code).toBe('not_down');
  });

  it('flags lower volume when transaction count drops sharply', () => {
    const result = buildSalesDropReasons({
      current: {
        revenue: 7000,
        saleCount: 70,
        aov: 100,
        dayCount: 30,
        revenuePerDay: 233.33,
        expenses: 2000,
      },
      prior,
    });
    expect(result.isDown).toBe(true);
    expect(result.reasons.some((r) => r.code === 'lower_volume')).toBe(true);
  });

  it('flags lower AOV when volume holds', () => {
    const result = buildSalesDropReasons({
      current: {
        revenue: 8000,
        saleCount: 100,
        aov: 80,
        dayCount: 30,
        revenuePerDay: 266.67,
        expenses: 2000,
      },
      prior,
    });
    expect(result.reasons.some((r) => r.code === 'lower_aov' || r.code === 'aov_drag')).toBe(true);
  });

  it('flags top product decline', () => {
    const result = buildSalesDropReasons({
      current: {
        revenue: 8000,
        saleCount: 90,
        aov: 88.89,
        dayCount: 30,
        revenuePerDay: 266.67,
        expenses: 2000,
      },
      prior,
      topProduct: {
        priorName: 'Widget A',
        priorRevenue: 4000,
        currentRevenue: 2000,
      },
    });
    expect(result.reasons.some((r) => r.code === 'top_product_decline')).toBe(true);
  });

  it('flags shorter period when daily pace is stable', () => {
    const result = buildSalesDropReasons({
      current: {
        revenue: 5000,
        saleCount: 50,
        aov: 100,
        dayCount: 15,
        revenuePerDay: 333.33,
        expenses: 1000,
      },
      prior,
    });
    expect(result.reasons.some((r) => r.code === 'shorter_period')).toBe(true);
  });
});
