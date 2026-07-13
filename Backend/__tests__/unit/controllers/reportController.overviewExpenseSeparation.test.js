jest.mock('../../../config/database', () => ({
  sequelize: {
    query: jest.fn(),
    fn: jest.fn((name, ...args) => ({ fn: name, args })),
    col: jest.fn((name) => ({ col: name })),
    literal: jest.fn((value) => ({ literal: value })),
    where: jest.fn((...args) => ({ where: args })),
    QueryTypes: { SELECT: 'SELECT' },
  },
}));

jest.mock('../../../models', () => ({
  Job: {},
  Expense: { sum: jest.fn() },
  Customer: { count: jest.fn() },
  Vendor: {},
  Invoice: { sum: jest.fn(), findOne: jest.fn(), findAll: jest.fn() },
  JobItem: {},
  Lead: {},
  Sale: { sum: jest.fn(), count: jest.fn(), findOne: jest.fn(), findAll: jest.fn() },
  SaleItem: { findAll: jest.fn() },
  Product: { findAll: jest.fn() },
  ProductVariant: {},
  Prescription: {},
  PrescriptionItem: {},
  Drug: {},
  MaterialMovement: {},
  MaterialItem: {},
  Payment: { count: jest.fn(), sum: jest.fn() },
  Tenant: {},
  Shop: {},
  Setting: {},
  UserShop: {},
  StudioLocation: {},
  UserStudioLocation: {},
  AccountBalance: {},
  Account: {},
  JournalEntry: {},
  JournalEntryLine: {},
}));

const { Expense, Customer, Invoice, Sale, SaleItem } = require('../../../models');
const reportController = require('../../../controllers/reportController');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

/**
 * Regression test for the "Reports Overview shows Total Expenses but Expenses page shows 0"
 * confusion report: for a shop/pharmacy tenant with zero approved Expense-table rows and
 * product cost of goods sold in the period, the overview KPI payload must expose
 * operatingExpenses (0, matching the Expenses page) and cogs (the product cost) as separate
 * fields rather than only a single combined "Total Expenses" figure.
 */
describe('reportController overview KPIs — Cost of Goods Sold vs Operating Expenses', () => {
  const baseReq = () => ({
    tenantId: 'tenant-shop-1',
    tenant: { businessType: 'shop' },
    query: {
      startDate: '2026-07-01',
      endDate: '2026-07-31',
    },
    shopScoped: false,
    studioLocationScoped: false,
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Revenue for the period (matches user report: ₵9,600).
    Sale.sum.mockImplementation((field) => {
      if (field === 'total') return Promise.resolve(9600);
      if (field === 'amountPaid') return Promise.resolve(9600);
      return Promise.resolve(0);
    });
    Sale.count.mockResolvedValue(12);

    // No approved, non-archived Expense-table rows — matches the Expenses page showing 0.
    Expense.sum.mockResolvedValue(0);

    // Product cost of goods sold for items sold in the period totals ₵3,100.
    SaleItem.findAll.mockResolvedValue([
      { quantity: 100, product: { costPrice: 31, trackStock: true }, variant: null },
    ]);

    Customer.count.mockResolvedValue(4);
    Invoice.sum.mockResolvedValue(0);
  });

  it('separates operatingExpenses (0, from the Expense table) from cogs (3100) instead of only returning a combined totalExpenses', async () => {
    const req = baseReq();
    const res = mockRes();

    await reportController.getOverviewExtendedKpis(req, res, jest.fn());

    const payload = res.json.mock.calls[0][0].data;
    const { current } = payload;

    expect(current.operatingExpenses).toBe(0); // must match Expenses page total (0)
    expect(current.cogs).toBe(3100); // 100 * 31 — cost of goods sold, not an Expense-table row
    expect(current.totalExpenses).toBe(3100); // combined subtotal only — never surfaced alone as "Total Expenses" in the UI
    expect(current.grossProfit).toBe(6500); // 9600 - 3100
    expect(current.netProfit).toBe(6500); // grossProfit - operatingExpenses(0)
    expect(current.grossProfitMargin).toBeCloseTo(67.71, 1);
    expect(current.netProfitMargin).toBeCloseTo(67.71, 1);
  });

  it('reports operatingExpenses/cogs comparisons separately from the combined totalExpenses comparison', async () => {
    const req = baseReq();
    req.query.compareStartDate = '2026-06-01';
    req.query.compareEndDate = '2026-06-30';
    const res = mockRes();

    // Previous period: some real operating expenses, no COGS (e.g. no product sales that month).
    let call = 0;
    Expense.sum.mockImplementation(() => {
      call += 1;
      // First call = current period (0 operating expenses), second = previous period (200).
      return Promise.resolve(call === 1 ? 0 : 200);
    });
    let saleItemCall = 0;
    SaleItem.findAll.mockImplementation(() => {
      saleItemCall += 1;
      // Current period has COGS; previous period has none.
      return Promise.resolve(
        saleItemCall === 1
          ? [{ quantity: 100, product: { costPrice: 31, trackStock: true }, variant: null }]
          : []
      );
    });

    await reportController.getOverviewExtendedKpis(req, res, jest.fn());

    const payload = res.json.mock.calls[0][0].data;
    expect(payload.comparison).toBeTruthy();
    // cogs went from 0 -> 3100 (previous had none), operatingExpenses went from 200 -> 0.
    expect(payload.comparison.cogs).toBe(100); // pctChange treats prev<=0, curr>0 as +100
    expect(payload.comparison.operatingExpenses).toBe(-100); // prev>0, curr<=0 as -100
    // The combined totalExpenses comparison must still be reported for backward compatibility.
    expect(payload.comparison).toHaveProperty('totalExpenses');
  });
});
