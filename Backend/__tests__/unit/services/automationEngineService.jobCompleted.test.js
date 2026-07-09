jest.mock('../../../models', () => ({
  AutomationRule: { findAll: jest.fn() },
  AutomationRun: { findOne: jest.fn(), create: jest.fn() },
  Customer: {},
  Invoice: {},
  Product: {},
  Quote: {},
  Sale: {},
  SaleItem: {},
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
jest.mock('../../../services/jobCustomerTrackingService', () => ({
  ensureJobViewToken: jest.fn(),
}));
jest.mock('../../../utils/jobCustomerMessageText', () => ({
  buildCustomerFacingJobTitle: jest.fn(),
}));

const { resolveBusinessNameForContext } = require('../../../utils/resolveBusinessNameForContext');
const { ensureJobViewToken } = require('../../../services/jobCustomerTrackingService');
const { buildCustomerFacingJobTitle } = require('../../../utils/jobCustomerMessageText');
const {
  buildJobCompletedTriggerContext,
  executeMatchingRules,
  runJobCompletedAutomations,
} = require('../../../services/automationEngineService');
const { AutomationRule, AutomationRun } = require('../../../models');

describe('automationEngineService job_completed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.FRONTEND_URL = 'https://app.example.com';
    resolveBusinessNameForContext.mockResolvedValue({
      businessName: 'Kofi Prints HQ',
      branchName: '',
    });
    ensureJobViewToken.mockResolvedValue('token-abc');
    buildCustomerFacingJobTitle.mockReturnValue('Business cards — 500 qty');
    AutomationRun.findOne.mockResolvedValue(null);
    AutomationRun.create.mockResolvedValue({ id: 'run-1' });
    AutomationRule.findAll.mockResolvedValue([]);
  });

  describe('buildJobCompletedTriggerContext', () => {
    it('builds customer, job, and tracking fields for messaging', () => {
      const context = buildJobCompletedTriggerContext({
        job: {
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
        trackingLink: 'https://app.example.com/track-job/token-abc',
        jobTitle: 'Business cards — 500 qty',
      });

      expect(context).toMatchObject({
        subjectKey: 'job_completed:job-1',
        jobId: 'job-1',
        jobNumber: 'JOB-1001',
        jobTitle: 'Business cards — 500 qty',
        customerId: 'cust-1',
        customerName: 'Ama Mensah',
        email: 'ama@example.com',
        phone: '+233201234567',
        trackingLink: 'https://app.example.com/track-job/token-abc',
        trackingLinkLine: 'Track your order: https://app.example.com/track-job/token-abc',
        hasTrackingLink: true,
        shopId: 'shop-a',
      });
      expect(context.message).toContain('JOB-1001');
      expect(context.message).toContain('track-job/token-abc');
    });

    it('omits tracking line when no tracking link is available', () => {
      const context = buildJobCompletedTriggerContext({
        job: { id: 'job-2', jobNumber: 'JOB-2002', customerId: 'cust-2' },
        customer: { id: 'cust-2', company: 'Acme Ltd', phone: '+233209999999' },
        trackingLink: null,
      });

      expect(context.trackingLinkLine).toBe('');
      expect(context.hasTrackingLink).toBe(false);
      expect(context.customerName).toBe('Acme Ltd');
    });
  });

  describe('runJobCompletedAutomations', () => {
    it('loads enabled job_completed rules and enriches businessName', async () => {
      const summary = await runJobCompletedAutomations({
        tenantId: 'tenant-1',
        job: {
          id: 'job-3',
          jobNumber: 'JOB-3003',
          customerId: 'cust-3',
          shopId: 'shop-b',
          customer: {
            id: 'cust-3',
            name: 'Kojo',
            email: 'kojo@example.com',
            phone: '+233201111111',
          },
        },
        actorUserId: 'user-1',
      });

      expect(ensureJobViewToken).toHaveBeenCalledWith('job-3', 'tenant-1');
      expect(AutomationRule.findAll).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1', enabled: true, triggerType: 'job_completed' },
        order: [['updatedAt', 'ASC']],
      });
      expect(resolveBusinessNameForContext).toHaveBeenCalledWith(
        'tenant-1',
        expect.objectContaining({
          triggerType: 'job_completed',
          jobNumber: 'JOB-3003',
          trackingLink: 'https://app.example.com/track-job/token-abc',
        })
      );
      expect(summary).toEqual({ rulesChecked: 0, executed: 0, skipped: 0, failed: 0 });
    });

    it('skips when job has no customer', async () => {
      const summary = await runJobCompletedAutomations({
        tenantId: 'tenant-1',
        job: { id: 'job-4', jobNumber: 'JOB-4004' },
      });

      expect(summary).toEqual({ skipped: true, reason: 'missing_customer' });
      expect(AutomationRule.findAll).not.toHaveBeenCalled();
    });
  });

  describe('executeMatchingRules', () => {
    it('uses job_completed trigger type', async () => {
      await executeMatchingRules({
        tenantId: 'tenant-1',
        triggerType: 'job_completed',
        triggerContext: buildJobCompletedTriggerContext({
          job: { id: 'job-5', jobNumber: 'JOB-5005', customerId: 'cust-5', shopId: 'shop-c' },
          customer: { id: 'cust-5', name: 'Esi', phone: '+233202222222' },
        }),
      });

      expect(AutomationRule.findAll).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1', enabled: true, triggerType: 'job_completed' },
        order: [['updatedAt', 'ASC']],
      });
    });
  });
});
