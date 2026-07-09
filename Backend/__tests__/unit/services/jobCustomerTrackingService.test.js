jest.mock('../../../models', () => ({
  Job: {
    findOne: jest.fn(),
  },
  JobItem: {},
  Customer: {},
  Setting: {
    findOne: jest.fn(),
  },
  Tenant: {
    findByPk: jest.fn(),
  },
}));

jest.mock('../../../services/emailService', () => ({
  sendMessage: jest.fn(),
}));

jest.mock('../../../services/smsService', () => ({
  getResolvedConfig: jest.fn(),
  validatePhoneNumber: jest.fn(),
  sendMessage: jest.fn(),
}));

jest.mock('../../../services/smsTemplateService', () => ({
  renderForTenant: jest.fn(),
}));

jest.mock('../../../services/emailTemplates', () => ({
  jobTrackingNotification: jest.fn(),
}));

const { Job, Setting, Tenant } = require('../../../models');
const emailService = require('../../../services/emailService');
const smsService = require('../../../services/smsService');
const smsTemplateService = require('../../../services/smsTemplateService');
const emailTemplates = require('../../../services/emailTemplates');
const {
  maybeSendJobTrackingEmailOnJobCreated,
  maybeSendJobTrackingSmsOnJobCreated,
} = require('../../../services/jobCustomerTrackingService');

describe('jobCustomerTrackingService', () => {
  const jobRecord = {
    id: 'job-1',
    tenantId: 'tenant-1',
    jobNumber: 'JOB-001',
    title: 'Logo design',
    viewToken: 'token-abc',
    update: jest.fn().mockResolvedValue(undefined),
    customer: {
      email: 'customer@example.com',
      phone: '+233241234567',
      name: 'Ada',
      smsConsent: true,
    },
    items: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    Setting.findOne.mockImplementation(({ where }) => {
      if (where.key === 'job-invoice') {
        return Promise.resolve({
          value: {
            customerJobTrackingEnabled: true,
            emailCustomerJobTrackingOnJobCreation: true,
            smsCustomerJobTrackingOnJobCreation: true,
          },
        });
      }
      if (where.key === 'organization') {
        return Promise.resolve({ value: { name: 'Studio Co' } });
      }
      return Promise.resolve(null);
    });
    Tenant.findByPk.mockResolvedValue({ id: 'tenant-1', name: 'Studio Co', metadata: {} });
    Job.findOne.mockResolvedValue(jobRecord);
    emailTemplates.jobTrackingNotification.mockReturnValue({
      subject: 'Track your job',
      html: '<p>Track</p>',
      text: 'Track',
    });
    emailService.sendMessage.mockResolvedValue({ success: true });
    smsService.getResolvedConfig.mockResolvedValue({ enabled: true });
    smsService.validatePhoneNumber.mockReturnValue('+233241234567');
    smsTemplateService.renderForTenant.mockResolvedValue('Track here: https://example.com/track-job/token-abc');
    smsService.sendMessage.mockResolvedValue({ success: true });
  });

  it('sends email when email tracking toggle is enabled', async () => {
    await maybeSendJobTrackingEmailOnJobCreated({
      tenantId: 'tenant-1',
      jobId: 'job-1',
      triggeredByUserId: 'user-1',
    });

    expect(emailService.sendMessage).toHaveBeenCalledWith(
      'tenant-1',
      'customer@example.com',
      'Track your job',
      '<p>Track</p>',
      'Track'
    );
    expect(smsService.sendMessage).not.toHaveBeenCalled();
  });

  it('sends SMS when SMS tracking toggle is enabled', async () => {
    await maybeSendJobTrackingSmsOnJobCreated({
      tenantId: 'tenant-1',
      jobId: 'job-1',
      triggeredByUserId: 'user-1',
    });

    expect(smsTemplateService.renderForTenant).toHaveBeenCalledWith(
      'tenant-1',
      'job_tracking_created',
      expect.objectContaining({
        customerName: 'Ada',
        businessName: 'Studio Co',
        jobNumber: 'JOB-001',
        trackingLink: expect.stringContaining('/track-job/token-abc'),
      })
    );
    expect(smsService.sendMessage).toHaveBeenCalledWith(
      'tenant-1',
      '+233241234567',
      'Track here: https://example.com/track-job/token-abc'
    );
    expect(emailService.sendMessage).not.toHaveBeenCalled();
  });

  it('skips SMS when customer opted out of SMS', async () => {
    Job.findOne.mockResolvedValue({
      ...jobRecord,
      customer: {
        ...jobRecord.customer,
        smsConsent: false,
      },
    });

    await maybeSendJobTrackingSmsOnJobCreated({
      tenantId: 'tenant-1',
      jobId: 'job-1',
      triggeredByUserId: 'user-1',
    });

    expect(smsService.sendMessage).not.toHaveBeenCalled();
  });
});
