jest.mock('../../../services/varianceDetectionService', () => ({
  detectStockVariance: jest.fn(),
  detectSuspiciousPatterns: jest.fn(),
  generateLeakageReport: jest.fn(),
  createVarianceAlerts: jest.fn(),
}));

const {
  detectStockVariance,
  detectSuspiciousPatterns,
} = require('../../../services/varianceDetectionService');
const { getStockVariance, getDashboardSummary } = require('../../../controllers/varianceController');

const makeRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

describe('varianceController scope', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    detectStockVariance.mockResolvedValue({
      success: true,
      data: {
        variances: [],
        productsWithVariance: 0,
        summary: { totalShrinkageValue: 0, highSeverity: 0 },
      },
    });
    detectSuspiciousPatterns.mockResolvedValue({
      success: true,
      data: { summary: { totalAlerts: 0 }, alerts: [] },
    });
  });

  it('uses req.shopFilterId for stock variance when set', async () => {
    const req = {
      tenantId: 'tenant-1',
      shopFilterId: 'shop-1',
      query: { shopId: 'shop-query' },
    };
    const res = makeRes();

    await getStockVariance(req, res);

    expect(detectStockVariance).toHaveBeenCalledWith('tenant-1', expect.objectContaining({
      shopId: 'shop-1',
    }));
    expect(res.json).toHaveBeenCalled();
  });

  it('falls back to query shopId when middleware scope is absent', async () => {
    const req = {
      tenantId: 'tenant-1',
      query: { shopId: 'shop-query' },
    };
    const res = makeRes();

    await getDashboardSummary(req, res);

    expect(detectStockVariance).toHaveBeenCalledWith('tenant-1', expect.objectContaining({
      shopId: 'shop-query',
    }));
    expect(res.json).toHaveBeenCalled();
  });
});
