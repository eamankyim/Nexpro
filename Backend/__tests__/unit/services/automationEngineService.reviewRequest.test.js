jest.mock('../../../models', () => ({
  AutomationRule: { findAll: jest.fn() },
  AutomationRun: { findOne: jest.fn(), create: jest.fn() },
  Customer: {},
  Invoice: {},
  Product: {},
  Quote: {},
  Sale: {},
  Tenant: { findByPk: jest.fn() },
  UserTask: { create: jest.fn() },
}));

jest.mock('../../../services/emailService', () => ({ sendPlatformMessage: jest.fn() }));
jest.mock('../../../services/smsService', () => ({ sendMessage: jest.fn() }));
jest.mock('../../../services/whatsappService', () => ({ sendMessage: jest.fn() }));
jest.mock('../../../services/emailTemplates', () => ({ marketingPlainMessageEmail: jest.fn((body) => body) }));
jest.mock('../../../utils/resolveBusinessNameForContext', () => ({
  resolveBusinessNameForContext: jest.fn(),
}));

const { resolveBusinessNameForContext } = require('../../../utils/resolveBusinessNameForContext');
const {
  buildReviewRequestTriggerContext,
  getTenantReviewLink,
  reviewLinkForTenant,
  executeMatchingRules,
  runReviewRequestAutomations,
} = require('../../../services/automationEngineService');
const { AutomationRule, Tenant } = require('../../../models');

describe('automationEngineService review_request', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveBusinessNameForContext.mockResolvedValue({
      businessName: 'Kofi Prints HQ',
      branchName: '',
    });
    Tenant.findByPk.mockResolvedValue({ slug: 'kofi-prints' });
  });

  describe('reviewLinkForTenant', () => {
    it('builds the public review URL from tenant slug', () => {
      expect(reviewLinkForTenant('kofi-prints')).toBe('http://localhost:3000/review/kofi-prints');
      expect(reviewLinkForTenant('')).toBeNull();
    });
  });

  describe('getTenantReviewLink', () => {
    it('returns review link metadata when slug exists', async () => {
      const result = await getTenantReviewLink('tenant-1');
      expect(Tenant.findByPk).toHaveBeenCalledWith('tenant-1', { attributes: ['slug'] });
      expect(result).toEqual({
        reviewLink: 'http://localhost:3000/review/kofi-prints',
        reviewUrl: 'http://localhost:3000/review/kofi-prints',
        reviewSlug: 'kofi-prints',
        hasReviewLink: true,
      });
    });

    it('returns empty link metadata when slug is missing', async () => {
      Tenant.findByPk.mockResolvedValue({ slug: null });
      const result = await getTenantReviewLink('tenant-2');
      expect(result.hasReviewLink).toBe(false);
      expect(result.reviewLink).toBeNull();
    });
  });

  describe('buildReviewRequestTriggerContext', () => {
    it('builds job completion context with review link', () => {
      const context = buildReviewRequestTriggerContext({
        sourceType: 'job',
        source: {
          id: 'job-1',
          jobNumber: 'JOB-1001',
          customerId: 'cust-1',
          shopId: 'shop-a',
        },
        customer: {
          id: 'cust-1',
          name: 'Ama Mensah',
          email: 'ama@example.com',
          phone: '+233201234567',
          whatsappConsent: true,
        },
        reviewLink: 'http://localhost:3000/review/kofi-prints',
        reviewSlug: 'kofi-prints',
      });

      expect(context).toMatchObject({
        subjectKey: 'review_request:customer:cust-1:job:job-1',
        sourceType: 'job',
        sourceId: 'job-1',
        jobNumber: 'JOB-1001',
        customerId: 'cust-1',
        customerName: 'Ama Mensah',
        reviewLink: 'http://localhost:3000/review/kofi-prints',
        reviewUrl: 'http://localhost:3000/review/kofi-prints',
        reviewSlug: 'kofi-prints',
        hasReviewLink: true,
        shopId: 'shop-a',
      });
      expect(context.message).toContain('/review/kofi-prints');
    });

    it('builds sale completion context from nested customer', () => {
      const context = buildReviewRequestTriggerContext({
        sourceType: 'sale',
        source: {
          id: 'sale-9',
          saleNumber: 'SALE-9001',
          customerId: 'cust-9',
          total: 250,
          customer: {
            id: 'cust-9',
            company: 'Acme Ltd',
            phone: '+233209999999',
          },
        },
        reviewLink: 'http://localhost:3000/review/acme-shop',
        reviewSlug: 'acme-shop',
      });

      expect(context.customerName).toBe('Acme Ltd');
      expect(context.saleNumber).toBe('SALE-9001');
      expect(context.subjectKey).toBe('review_request:customer:cust-9:sale:sale-9');
      expect(context.totalAmount).toBe(250);
    });
  });

  describe('runReviewRequestAutomations', () => {
    it('skips when customer is missing', async () => {
      const result = await runReviewRequestAutomations({
        tenantId: 'tenant-1',
        sourceType: 'sale',
        source: { id: 'sale-1' },
      });
      expect(result).toEqual({ skipped: true, reason: 'missing_customer' });
    });

    it('loads enabled review_request rules and enriches businessName', async () => {
      AutomationRule.findAll.mockResolvedValue([]);

      const summary = await runReviewRequestAutomations({
        tenantId: 'tenant-1',
        sourceType: 'invoice',
        source: {
          id: 'inv-1',
          invoiceNumber: 'INV-5001',
          customerId: 'cust-1',
          totalAmount: 100,
        },
        customer: {
          id: 'cust-1',
          name: 'Test Customer',
          email: 'test@example.com',
        },
      });

      expect(AutomationRule.findAll).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1', enabled: true, triggerType: 'review_request' },
        order: [['updatedAt', 'ASC']],
      });
      expect(resolveBusinessNameForContext).toHaveBeenCalledWith(
        'tenant-1',
        expect.objectContaining({
          triggerType: 'review_request',
          invoiceNumber: 'INV-5001',
          reviewLink: 'http://localhost:3000/review/kofi-prints',
        })
      );
      expect(summary).toMatchObject({
        rulesChecked: 0,
        executed: 0,
        skipped: 0,
        failed: 0,
        hasReviewLink: true,
      });
    });
  });

  describe('executeMatchingRules', () => {
    it('passes review link placeholders through enriched context', async () => {
      AutomationRule.findAll.mockResolvedValue([]);

      await executeMatchingRules({
        tenantId: 'tenant-1',
        triggerType: 'review_request',
        triggerContext: buildReviewRequestTriggerContext({
          sourceType: 'job',
          source: { id: 'job-2', jobNumber: 'JOB-2002', customerId: 'cust-2' },
          customer: { id: 'cust-2', name: 'Kofi' },
          reviewLink: 'http://localhost:3000/review/demo',
          reviewSlug: 'demo',
        }),
      });

      expect(resolveBusinessNameForContext).toHaveBeenCalledWith(
        'tenant-1',
        expect.objectContaining({
          triggerType: 'review_request',
          reviewLink: 'http://localhost:3000/review/demo',
          customerName: 'Kofi',
        })
      );
    });
  });
});
