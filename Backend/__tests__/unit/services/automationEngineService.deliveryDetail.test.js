jest.mock('../../../models', () => ({
  AutomationRule: { findAll: jest.fn() },
  AutomationRun: { findOne: jest.fn(), create: jest.fn() },
  AutomationDelayedRun: {
    findOne: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  Customer: {},
  Invoice: {},
  Product: {},
  Quote: {},
  Sale: {},
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
jest.mock('../../../services/automationRecipientService', () => ({
  isInternalAudience: jest.fn(() => false),
  resolveStaffRecipients: jest.fn(async () => []),
  getActionRecipientConfig: jest.fn(() => null),
}));

const emailService = require('../../../services/emailService');
const smsService = require('../../../services/smsService');
const whatsappService = require('../../../services/whatsappService');
const emailTemplates = require('../../../services/emailTemplates');
const {
  isInternalAudience,
  resolveStaffRecipients,
  getActionRecipientConfig,
} = require('../../../services/automationRecipientService');
const { executeRule } = require('../../../services/automationEngineService');
const { AutomationRun } = require('../../../models');

describe('automationEngineService delivery detail result shape', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AutomationRun.findOne.mockResolvedValue(null);
    AutomationRun.create.mockResolvedValue({ id: 'run-1' });
    emailService.sendPlatformMessage.mockResolvedValue({ success: true });
    smsService.sendMessage.mockResolvedValue({ success: true, messageId: 'sms-msg-1' });
    whatsappService.sendMessage.mockResolvedValue({ success: true, messageId: 'wa-msg-1' });
    isInternalAudience.mockReturnValue(false);
    getActionRecipientConfig.mockReturnValue(null);
    resolveStaffRecipients.mockResolvedValue([]);
  });

  const customerContext = {
    subjectKey: 'payment_received:inv-1:pay-1',
    customerId: 'cust-1',
    customerName: 'Ama Mensah',
    email: 'ama@example.com',
    phone: '+233201234567',
  };

  it('includes recipient delivery fields for send_email_platform', async () => {
    await executeRule({
      rule: {
        id: 'rule-email',
        name: 'Pay thanks',
        enabled: true,
        triggerType: 'payment_received',
        triggerConfig: {},
        conditionConfig: {},
        actionConfig: {
          actions: [{ type: 'send_email_platform', subject: 'Thanks', body: 'Paid' }],
        },
      },
      tenantId: 'tenant-1',
      triggerContext: customerContext,
      options: { skipDedupe: true, skipDelay: true },
    });

    const createArg = AutomationRun.create.mock.calls[0][0];
    const result = createArg.resultSummary.results[0];
    expect(result).toMatchObject({
      type: 'send_email_platform',
      channel: 'email',
      success: true,
      recipientName: 'Ama Mensah',
      recipientAddress: 'ama@example.com',
      customerId: 'cust-1',
      recipientUserId: null,
    });
    expect(result.sentAt).toEqual(expect.any(String));
    expect(Number.isNaN(Date.parse(result.sentAt))).toBe(false);
    expect(result).not.toHaveProperty('body');
    expect(result).not.toHaveProperty('subject');
    expect(emailTemplates.marketingPlainMessageEmail).toHaveBeenCalledWith(
      'Paid',
      expect.objectContaining({ audience: 'customer' })
    );
  });

  it('includes recipient delivery fields for send_sms', async () => {
    await executeRule({
      rule: {
        id: 'rule-sms',
        name: 'SMS thanks',
        enabled: true,
        triggerType: 'payment_received',
        triggerConfig: {},
        conditionConfig: {},
        actionConfig: {
          actions: [{ type: 'send_sms', body: 'Thanks' }],
        },
      },
      tenantId: 'tenant-1',
      triggerContext: customerContext,
      options: { skipDedupe: true, skipDelay: true },
    });

    const result = AutomationRun.create.mock.calls[0][0].resultSummary.results[0];
    expect(result).toMatchObject({
      type: 'send_sms',
      channel: 'sms',
      success: true,
      recipientName: 'Ama Mensah',
      recipientAddress: '+233201234567',
      customerId: 'cust-1',
      messageId: 'sms-msg-1',
    });
    expect(result.sentAt).toEqual(expect.any(String));
  });

  it('includes recipient delivery fields for send_whatsapp', async () => {
    await executeRule({
      rule: {
        id: 'rule-wa',
        name: 'WA thanks',
        enabled: true,
        triggerType: 'payment_received',
        triggerConfig: {},
        conditionConfig: {},
        actionConfig: {
          actions: [{ type: 'send_whatsapp', templateName: 'hello_world' }],
        },
      },
      tenantId: 'tenant-1',
      triggerContext: customerContext,
      options: { skipDedupe: true, skipDelay: true },
    });

    const result = AutomationRun.create.mock.calls[0][0].resultSummary.results[0];
    expect(result).toMatchObject({
      type: 'send_whatsapp',
      channel: 'whatsapp',
      success: true,
      recipientName: 'Ama Mensah',
      recipientAddress: '+233201234567',
      customerId: 'cust-1',
      messageId: 'wa-msg-1',
    });
    expect(result.sentAt).toEqual(expect.any(String));
  });

  it('includes staff recipient fields on internal fan-out', async () => {
    isInternalAudience.mockReturnValue(true);
    getActionRecipientConfig.mockReturnValue({ type: 'role', roles: ['owner'] });
    resolveStaffRecipients.mockResolvedValue([
      { userId: 'user-9', name: 'Kojo Staff', email: 'kojo@biz.com', phone: '+233209999999' },
    ]);

    await executeRule({
      rule: {
        id: 'rule-staff',
        name: 'Staff alert',
        enabled: true,
        triggerType: 'daily_sales_summary',
        triggerConfig: {},
        conditionConfig: {},
        metadata: { audience: 'internal' },
        actionConfig: {
          actions: [{ type: 'send_sms', body: 'Summary', audience: 'internal' }],
        },
      },
      tenantId: 'tenant-1',
      triggerContext: { subjectKey: 'daily_sales:2026-07-12', scheduler: true },
      options: { skipDedupe: true, skipDelay: true },
    });

    const result = AutomationRun.create.mock.calls[0][0].resultSummary.results[0];
    expect(result).toMatchObject({
      type: 'send_sms',
      channel: 'sms',
      success: true,
      recipientName: 'Kojo Staff',
      recipientAddress: '+233209999999',
      recipientUserId: 'user-9',
      messageId: 'sms-msg-1',
    });
    expect(result.sentAt).toEqual(expect.any(String));
  });

  it('passes internal audience into email template for staff alerts', async () => {
    isInternalAudience.mockReturnValue(true);
    getActionRecipientConfig.mockReturnValue({ type: 'role', roles: ['owner', 'manager'] });
    resolveStaffRecipients.mockResolvedValue([
      { userId: 'user-1', name: 'Admin', email: 'admin@biz.com', phone: null },
    ]);

    await executeRule({
      rule: {
        id: 'rule-job-created-staff',
        name: 'Job created — staff alert',
        enabled: true,
        triggerType: 'job_created_staff',
        triggerConfig: {},
        conditionConfig: {},
        metadata: { audience: 'internal' },
        actionConfig: {
          audience: 'internal',
          actions: [{
            type: 'send_email_platform',
            audience: 'internal',
            subject: 'New job JOB-TEST-0001',
            body: 'Job JOB-TEST-0001 (Sample print job) was created for Eric Amankyim.',
          }],
        },
      },
      tenantId: 'tenant-1',
      triggerContext: {
        subjectKey: 'job_created_staff:job-1',
        businessName: 'iCreations Digital Group',
        jobNumber: 'JOB-TEST-0001',
      },
      options: { skipDedupe: true, skipDelay: true },
    });

    expect(emailTemplates.marketingPlainMessageEmail).toHaveBeenCalledWith(
      'Job JOB-TEST-0001 (Sample print job) was created for Eric Amankyim.',
      expect.objectContaining({
        name: 'iCreations Digital Group',
        audience: 'internal',
      })
    );
  });
});
