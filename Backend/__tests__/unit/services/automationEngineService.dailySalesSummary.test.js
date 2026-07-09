jest.mock('../../../models', () => ({
  AutomationRule: { findAll: jest.fn() },
  AutomationRun: { findOne: jest.fn(), create: jest.fn() },
  Customer: {},
  Invoice: {},
  Product: {},
  Quote: {},
  Sale: { findOne: jest.fn(), findAll: jest.fn() },
  SaleItem: { findAll: jest.fn() },
  Tenant: {},
  UserTask: { create: jest.fn() },
}));

jest.mock('../../../services/emailService', () => ({ sendPlatformMessage: jest.fn() }));
jest.mock('../../../services/smsService', () => ({ sendMessage: jest.fn() }));
jest.mock('../../../services/whatsappService', () => ({ sendMessage: jest.fn() }));
jest.mock('../../../services/emailTemplates', () => ({ marketingPlainMessageEmail: jest.fn((body) => body) }));
jest.mock('../../../utils/resolveBusinessNameForContext', () => ({
  resolveBusinessNameForContext: jest.fn(),
}));
jest.mock('../../../utils/documentOrganizationUtils', () => ({
  loadTenantOrganization: jest.fn(),
}));

const { resolveBusinessNameForContext } = require('../../../utils/resolveBusinessNameForContext');
const { loadTenantOrganization } = require('../../../utils/documentOrganizationUtils');
const {
  buildDailySalesSummaryContext,
  getTriggerContextsForRule,
} = require('../../../services/automationEngineService');
const { Sale, SaleItem } = require('../../../models');

describe('automationEngineService daily_sales_summary', () => {
  const now = new Date('2026-07-09T07:30:00.000Z');

  beforeEach(() => {
    jest.clearAllMocks();
    resolveBusinessNameForContext.mockResolvedValue({
      businessName: 'Shop Central',
      branchName: '',
    });
    loadTenantOrganization.mockResolvedValue({
      organization: { email: 'team@shop.example.com', name: 'Shop Central' },
    });
    Sale.findOne.mockResolvedValue({ transactionCount: '8', totalSales: '1250.50' });
    Sale.findAll.mockResolvedValue([{ id: 'sale-1' }, { id: 'sale-2' }]);
    SaleItem.findAll.mockResolvedValue([
      { name: 'T-Shirt', revenue: '450.00' },
      { name: 'Cap', revenue: '320.00' },
    ]);
  });

  describe('buildDailySalesSummaryContext', () => {
    it('aggregates sales stats and resolves team email', async () => {
      const periodStart = new Date('2026-07-08T00:00:00.000Z');
      const periodEnd = new Date('2026-07-08T23:59:59.999Z');

      const context = await buildDailySalesSummaryContext('tenant-1', {
        periodStart,
        periodEnd,
        periodLabel: 'yesterday',
        now,
      });

      expect(Sale.findOne).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          status: expect.any(Object),
        }),
      }));
      expect(loadTenantOrganization).toHaveBeenCalledWith('tenant-1');
      expect(context).toMatchObject({
        subjectKey: expect.stringContaining('daily_sales_summary:'),
        periodLabel: 'yesterday',
        transactionCount: 8,
        totalSales: 1250.5,
        totalSalesFormatted: 'GHS 1,250.50',
        topProducts: expect.stringContaining('T-Shirt'),
        email: 'team@shop.example.com',
        customerHasEmail: true,
        scheduler: true,
      });
      expect(context.message).toContain('8 transaction');
    });

    it('uses None for top products when there are no sales', async () => {
      Sale.findOne.mockResolvedValue({ transactionCount: '0', totalSales: '0' });
      Sale.findAll.mockResolvedValue([]);

      const context = await buildDailySalesSummaryContext('tenant-2', {
        periodStart: new Date('2026-07-08T00:00:00.000Z'),
        periodEnd: new Date('2026-07-08T23:59:59.999Z'),
        periodLabel: 'yesterday',
        now,
      });

      expect(context.topProducts).toBe('None');
      expect(context.transactionCount).toBe(0);
      expect(SaleItem.findAll).not.toHaveBeenCalled();
    });
  });

  describe('getTriggerContextsForRule', () => {
    it('builds one scheduler context for daily_sales_summary rules', async () => {
      const contexts = await getTriggerContextsForRule({
        tenantId: 'tenant-1',
        triggerType: 'daily_sales_summary',
        triggerConfig: { summaryPeriod: 'yesterday' },
      }, now);

      expect(contexts).toHaveLength(1);
      expect(resolveBusinessNameForContext).toHaveBeenCalledWith(
        'tenant-1',
        expect.objectContaining({
          triggerType: 'daily_sales_summary',
          transactionCount: 8,
        })
      );
      expect(contexts[0].businessName).toBe('Shop Central');
    });

    it('supports today summary period', async () => {
      await getTriggerContextsForRule({
        tenantId: 'tenant-1',
        triggerType: 'daily_sales_summary',
        triggerConfig: { summaryPeriod: 'today' },
      }, now);

      expect(Sale.findOne).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          createdAt: expect.any(Object),
        }),
      }));
    });
  });
});
