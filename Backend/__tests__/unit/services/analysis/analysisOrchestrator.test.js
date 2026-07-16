jest.mock('../../../../services/analysis/metrics/sales', () => ({
  getSalesToday: jest.fn(),
  getSalesThisMonth: jest.fn(),
  getSalesVsPriorPeriod: jest.fn(),
}));

jest.mock('../../../../services/analysis/metrics/topProducts', () => ({
  getTopProducts: jest.fn(),
  getTopProductCompare: jest.fn(),
}));

jest.mock('../../../../services/analysis/metrics/receivables', () => ({
  getReceivables: jest.fn(),
}));

jest.mock('../../../../services/analysis/metrics/lowStock', () => ({
  getLowStock: jest.fn(),
}));

const {
  getSalesToday,
  getSalesThisMonth,
  getSalesVsPriorPeriod,
} = require('../../../../services/analysis/metrics/sales');
const { getTopProductCompare } = require('../../../../services/analysis/metrics/topProducts');
const { getReceivables } = require('../../../../services/analysis/metrics/receivables');
const { getLowStock } = require('../../../../services/analysis/metrics/lowStock');
const { runAnalysis } = require('../../../../services/analysis/analysisOrchestrator');
const { computeAlignedProfit } = require('../../../../services/analysis/profitFormulas');

describe('analysisOrchestrator happy paths', () => {
  const ctx = { tenantId: 'tenant-1' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns sales_today DTO with metrics and answerMarkdown', async () => {
    getSalesToday.mockResolvedValue({
      period: {
        label: 'Today',
        revenue: 500,
        expenses: 100,
        profit: 400,
        operatingExpenses: 80,
        cogs: 20,
        isRetail: true,
        saleCount: 5,
        aov: 100,
      },
    });

    const out = await runAnalysis('How much did I sell today?', ctx);
    expect(out.route).toBe('analysis');
    expect(out.result.intent).toBe('sales_today');
    expect(out.result.answerMarkdown).toMatch(/brought in|revenue|haven't recorded|No completed sales/i);
    expect(out.result.metrics.period.revenue).toBe(500);
    expect(out.result.meta.source).toBe('analysis_engine');
  });

  it('returns why_sales_down with reasons checklist', async () => {
    getSalesVsPriorPeriod.mockResolvedValue({
      current: {
        label: 'This month',
        revenue: 7000,
        saleCount: 70,
        aov: 100,
        dayCount: 30,
        revenuePerDay: 233.33,
        expenses: 2000,
        profit: 5000,
      },
      prior: {
        label: 'Prior period',
        revenue: 10000,
        saleCount: 100,
        aov: 100,
        dayCount: 30,
        revenuePerDay: 333.33,
        expenses: 2000,
        profit: 8000,
      },
      changes: {
        revenuePct: -30,
        profitPct: -37.5,
        expensesPct: 0,
        saleCountPct: -30,
        aovPct: 0,
        revenuePerDayPct: -30,
      },
    });
    getTopProductCompare.mockResolvedValue({
      priorTop: { productName: 'Widget', totalRevenue: 4000 },
      currentTop: { productName: 'Other', totalRevenue: 2000 },
      currentSameAsPrior: { productName: 'Widget', totalRevenue: 2000 },
    });

    const out = await runAnalysis('Why are sales down?', ctx);
    expect(out.route).toBe('analysis');
    expect(out.result.intent).toBe('why_sales_down');
    expect(out.result.reasons.length).toBeGreaterThan(0);
    expect(out.result.answerMarkdown).toMatch(/What's driving it|Good news/i);
  });

  it('returns performance_summary with insight card fields', async () => {
    getSalesVsPriorPeriod.mockResolvedValue({
      current: {
        label: 'This month',
        revenue: 12000,
        profit: 3000,
        expenses: 9000,
      },
      prior: {
        label: 'Prior period',
        revenue: 10000,
        profit: 2500,
        expenses: 7500,
      },
      changes: {
        revenuePct: 20,
        profitPct: 20,
        expensesPct: 20,
        saleCountPct: 10,
        aovPct: 5,
        revenuePerDayPct: 20,
      },
    });
    getLowStock.mockResolvedValue({ lowStockCount: 0, products: [], isRetail: true });
    getReceivables.mockResolvedValue({
      totalOutstanding: 0,
      overdueOutstanding: 0,
      outstandingInvoiceCount: 0,
      topDebtors: [],
    });

    const out = await runAnalysis('Summarize performance', ctx);
    expect(out.result.intent).toBe('performance_summary');
    expect(out.result.insight).toMatchObject({
      title: expect.any(String),
      body: expect.any(String),
    });
  });

  it('routes support without fetching metrics', async () => {
    const out = await runAnalysis('How do I create an invoice?', ctx);
    expect(out.route).toBe('support');
    expect(getSalesToday).not.toHaveBeenCalled();
    expect(getSalesThisMonth).not.toHaveBeenCalled();
  });

  it('aligns retail profit with COGS formula', () => {
    const aligned = computeAlignedProfit({
      revenue: 500,
      operatingExpenses: 40,
      cogs: 120,
      isRetail: true,
    });
    expect(aligned.netProfit).toBe(340);
    expect(aligned.grossProfit).toBe(380);
    expect(aligned.totalExpenses).toBe(160);
  });
});
