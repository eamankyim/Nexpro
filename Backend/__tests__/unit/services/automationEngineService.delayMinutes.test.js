jest.mock('../../../models', () => ({
  AutomationRule: { findAll: jest.fn(), findByPk: jest.fn() },
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
  Tenant: { findByPk: jest.fn() },
  UserTask: { create: jest.fn() },
}));

jest.mock('../../../services/emailService', () => ({ sendPlatformMessage: jest.fn() }));
jest.mock('../../../services/smsService', () => ({ sendMessage: jest.fn() }));
jest.mock('../../../services/whatsappService', () => ({ sendMessage: jest.fn() }));
jest.mock('../../../services/emailTemplates', () => ({ marketingPlainMessageEmail: jest.fn((body) => body) }));
jest.mock('../../../utils/resolveBusinessNameForContext', () => ({
  resolveBusinessNameForContext: jest.fn().mockResolvedValue({
    businessName: 'Test Biz',
    branchName: '',
  }),
}));

const smsService = require('../../../services/smsService');
const {
  AutomationRule,
  AutomationRun,
  AutomationDelayedRun,
} = require('../../../models');
const {
  getDelayMinutes,
  getTemplateByKey,
  DEFAULT_REVIEW_REQUEST_DELAY_MINUTES,
  enqueueDelayedRun,
  processDueDelayedRuns,
  executeRule,
  executeMatchingRules,
} = require('../../../services/automationEngineService');

describe('automationEngineService delayMinutes / Send after', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AutomationRun.findOne.mockResolvedValue(null);
    AutomationRun.create.mockResolvedValue({ id: 'run-1' });
    AutomationDelayedRun.findOne.mockResolvedValue(null);
    AutomationDelayedRun.findAll.mockResolvedValue([]);
    AutomationDelayedRun.create.mockImplementation(async (payload) => ({
      id: 'delayed-1',
      ...payload,
      update: jest.fn(),
    }));
    AutomationDelayedRun.update.mockResolvedValue([1]);
    smsService.sendMessage.mockResolvedValue({ success: true, messageId: 'sms-1' });
  });

  describe('getDelayMinutes / template seed', () => {
    it('seeds review_request template with delayMinutes 60', () => {
      const template = getTemplateByKey('review_request');
      expect(template.scheduleConfig.delayMinutes).toBe(DEFAULT_REVIEW_REQUEST_DELAY_MINUTES);
      expect(DEFAULT_REVIEW_REQUEST_DELAY_MINUTES).toBe(60);
    });

    it('reads delayMinutes from scheduleConfig for event triggers', () => {
      expect(getDelayMinutes({
        triggerType: 'payment_received',
        scheduleConfig: { delayMinutes: 3 },
      })).toBe(3);
      expect(getDelayMinutes({
        triggerType: 'review_request',
        scheduleConfig: { delayMinutes: 60, cooldownHours: 168 },
      })).toBe(60);
    });

    it('defaults missing delayMinutes to 0', () => {
      expect(getDelayMinutes({
        triggerType: 'job_completed',
        scheduleConfig: {},
      })).toBe(0);
    });

    it('ignores delayMinutes for sticky triggers', () => {
      expect(getDelayMinutes({
        triggerType: 'invoice_overdue',
        scheduleConfig: { delayMinutes: 60, frequency: 'weekly' },
      })).toBe(0);
    });
  });

  describe('enqueueDelayedRun', () => {
    it('creates a pending delayed run with runAt in the future', async () => {
      const before = Date.now();
      const result = await enqueueDelayedRun({
        tenantId: 'tenant-1',
        ruleId: 'rule-1',
        triggerContext: { subjectKey: 'review_request:customer:c1:job:j1', customerName: 'Ama' },
        delayMinutes: 60,
        actorUserId: 'user-1',
      });
      expect(AutomationDelayedRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          ruleId: 'rule-1',
          status: 'pending',
          subjectKey: 'review_request:customer:c1:job:j1',
        })
      );
      expect(result.delayed).toBe(true);
      expect(result.delayedRunId).toBe('delayed-1');
      expect(new Date(result.runAt).getTime()).toBeGreaterThanOrEqual(before + 59 * 60 * 1000);
    });

    it('dedupes when a pending run already exists for the same subjectKey', async () => {
      const existingRunAt = new Date(Date.now() + 30 * 60 * 1000);
      AutomationDelayedRun.findOne.mockResolvedValue({
        id: 'existing-delayed',
        runAt: existingRunAt,
      });

      const result = await enqueueDelayedRun({
        tenantId: 'tenant-1',
        ruleId: 'rule-1',
        triggerContext: { subjectKey: 'same-key' },
        delayMinutes: 60,
      });

      expect(AutomationDelayedRun.create).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        delayed: true,
        delayedRunId: 'existing-delayed',
        reason: 'already_pending',
      });
    });
  });

  describe('executeRule delay enqueue', () => {
    const baseRule = {
      id: 'rule-1',
      enabled: true,
      triggerType: 'review_request',
      scheduleConfig: { delayMinutes: 60, cooldownHours: 168 },
      conditionConfig: {},
      triggerConfig: {},
      actionConfig: {
        actions: [{ type: 'send_sms', body: 'Please review us' }],
      },
      name: 'Review request',
    };

    it('enqueues instead of executing when delayMinutes > 0', async () => {
      const result = await executeRule({
        rule: baseRule,
        tenantId: 'tenant-1',
        triggerContext: {
          subjectKey: 'review_request:customer:c1:job:j1',
          phone: '+233201234567',
          message: 'hi',
        },
      });

      expect(result.delayed).toBe(true);
      expect(result.delayMinutes).toBe(60);
      expect(AutomationDelayedRun.create).toHaveBeenCalled();
      expect(AutomationRun.create).not.toHaveBeenCalled();
    });

    it('runs immediately when skipDelay is true (manual test)', async () => {
      const result = await executeRule({
        rule: baseRule,
        tenantId: 'tenant-1',
        triggerContext: {
          subjectKey: 'review_request:customer:c1:job:j1',
          phone: '+233201234567',
          message: 'hi',
          manualTest: true,
        },
        options: { skipDelay: true, skipDedupe: true, alwaysRecordRun: true },
      });

      expect(result.delayed).toBeUndefined();
      expect(AutomationDelayedRun.create).not.toHaveBeenCalled();
      expect(AutomationRun.create).toHaveBeenCalled();
    });

    it('ignores delayMinutes on scheduler path', async () => {
      const result = await executeRule({
        rule: {
          ...baseRule,
          triggerType: 'invoice_overdue',
          scheduleConfig: { delayMinutes: 60, frequency: 'weekly', cooldownHours: 168 },
          actionConfig: {
            actions: [{ type: 'send_email_platform', subject: 'Overdue', body: 'Pay' }],
          },
        },
        tenantId: 'tenant-1',
        triggerContext: {
          subjectKey: 'invoice_overdue:inv-1',
          email: 'a@b.com',
          message: 'pay',
          scheduler: true,
        },
      });

      expect(result.delayed).toBeUndefined();
      expect(AutomationDelayedRun.create).not.toHaveBeenCalled();
    });
  });

  describe('executeMatchingRules delayed summary', () => {
    it('counts delayed rules in summary', async () => {
      AutomationRule.findAll.mockResolvedValue([{
        id: 'rule-1',
        enabled: true,
        triggerType: 'payment_received',
        scheduleConfig: { delayMinutes: 3 },
        conditionConfig: {},
        triggerConfig: {},
        actionConfig: {
          actions: [{ type: 'send_sms', body: 'Thanks' }],
        },
        name: 'Thank you',
      }]);

      const summary = await executeMatchingRules({
        tenantId: 'tenant-1',
        triggerType: 'payment_received',
        triggerContext: {
          subjectKey: 'payment:inv-1',
          phone: '+233200000000',
          message: 'thanks',
        },
      });

      expect(summary).toMatchObject({
        rulesChecked: 1,
        delayed: 1,
        executed: 0,
        skipped: 0,
        failed: 0,
      });
    });
  });

  describe('processDueDelayedRuns', () => {
    it('claims due rows and executes with skipDelay', async () => {
      const updateFn = jest.fn().mockResolvedValue(undefined);
      const delayedRow = {
        id: 'delayed-1',
        tenantId: 'tenant-1',
        ruleId: 'rule-1',
        status: 'pending',
        runAt: new Date(Date.now() - 1000),
        triggerContext: {
          subjectKey: 'review_request:customer:c1:job:j1',
          phone: '+233201234567',
          message: 'review please',
        },
        update: updateFn,
      };
      AutomationDelayedRun.findAll.mockResolvedValue([delayedRow]);
      AutomationDelayedRun.update.mockResolvedValue([1]);
      AutomationRule.findByPk.mockResolvedValue({
        id: 'rule-1',
        enabled: true,
        triggerType: 'review_request',
        scheduleConfig: { delayMinutes: 60, cooldownHours: 168 },
        conditionConfig: {},
        triggerConfig: {},
        actionConfig: {
          actions: [{ type: 'send_sms', body: 'Please review us' }],
        },
        name: 'Review request',
        createdBy: null,
        updatedBy: null,
      });

      const summary = await processDueDelayedRuns({ now: new Date() });

      expect(AutomationDelayedRun.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'processing' }),
        expect.objectContaining({ where: { id: 'delayed-1', status: 'pending' } })
      );
      expect(summary.executed).toBe(1);
      expect(updateFn).toHaveBeenCalledWith(expect.objectContaining({ status: 'done' }));
      expect(AutomationRun.create).toHaveBeenCalled();
    });

    it('cancels when rule is disabled', async () => {
      const updateFn = jest.fn().mockResolvedValue(undefined);
      AutomationDelayedRun.findAll.mockResolvedValue([{
        id: 'delayed-2',
        tenantId: 'tenant-1',
        ruleId: 'rule-2',
        status: 'pending',
        runAt: new Date(Date.now() - 1000),
        triggerContext: { subjectKey: 'x' },
        update: updateFn,
      }]);
      AutomationDelayedRun.update.mockResolvedValue([1]);
      AutomationRule.findByPk.mockResolvedValue({
        id: 'rule-2',
        enabled: false,
        triggerType: 'payment_received',
        scheduleConfig: { delayMinutes: 3 },
        conditionConfig: {},
        triggerConfig: {},
        actionConfig: { actions: [] },
        name: 'Paused',
      });

      const summary = await processDueDelayedRuns();

      expect(summary.cancelled).toBe(1);
      expect(updateFn).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'cancelled', error: 'rule_disabled' })
      );
    });
  });
});
