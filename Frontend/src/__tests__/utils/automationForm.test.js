import { describe, it, expect } from 'vitest';
import {
  DEFAULT_ACTION_CONTENT,
  buildRulePayloadFromForm,
  buildScheduleConfigFromForm,
  conditionFormFromConfig,
  defaultActionFormRow,
  defaultDelayMinutesForTrigger,
  defaultFrequencyForTrigger,
  formatPlaceholderHint,
  getEventTimingCopy,
  getReviewAdditionalSettingsLines,
  getWhatHappensNextTiming,
  isStickyTrigger,
  prefillActionRow,
  prefillActionRows,
  resolveAutomationBranchLabel,
  scheduleFormFromConfig,
  supportsSendAfter,
  usesDailySchedule,
} from '../../utils/automationForm';

describe('automationForm action prefill', () => {
  it('prefills birthday SMS with placeholders when body is empty', () => {
    const row = defaultActionFormRow('send_sms', 'customer_birthday');
    expect(row.body).toContain('{{customerName}}');
    expect(row.body).toContain('{{businessName}}');
    expect(row.body).toMatch(/Happy birthday/i);
  });

  it('does not overwrite user-edited messaging fields', () => {
    const row = prefillActionRow(
      { type: 'send_sms', body: 'Custom message' },
      'customer_birthday'
    );
    expect(row.body).toBe('Custom message');
  });

  it('prefills only empty fields when trigger changes', () => {
    const rows = prefillActionRows(
      [
        { type: 'send_sms', body: 'Keep this' },
        { type: 'send_email_platform', subject: '', body: '' },
      ],
      'invoice_overdue'
    );
    expect(rows[0].body).toBe('Keep this');
    expect(rows[1].subject).toContain('{{invoiceNumber}}');
    expect(rows[1].body).toContain('{{paymentLink}}');
  });

  it('lists placeholders for the selected trigger', () => {
    expect(formatPlaceholderHint('customer_birthday')).toContain('{{customerName}}');
    expect(formatPlaceholderHint('low_stock_detected')).toContain('{{productName}}');
    expect(formatPlaceholderHint('review_request')).toContain('{{reviewLink}}');
  });

  it('lists placeholders for job completed and daily sales summary triggers', () => {
    expect(formatPlaceholderHint('job_completed')).toContain('{{trackingLink}}');
    expect(formatPlaceholderHint('daily_sales_summary')).toContain('{{totalSalesFormatted}}');
  });

  it('lists placeholders for order_created trigger', () => {
    expect(formatPlaceholderHint('order_created')).toContain('{{trackingLink}}');
    expect(formatPlaceholderHint('order_created')).toContain('{{orderNumber}}');
  });

  it('prefills order_created SMS with tracking link', () => {
    const row = defaultActionFormRow('send_sms', 'order_created');
    expect(row.body).toContain('{{trackingLink}}');
    expect(row.body).toContain('{{orderNumber}}');
    expect(row.body).not.toMatch(/ETA|ready in|minutes/i);
  });

  it('prefills job completed email with tracking line placeholder', () => {
    const row = defaultActionFormRow('send_email_platform', 'job_completed');
    expect(row.body).toContain('{{trackingLinkLine}}');
    expect(row.subject).toContain('{{jobNumber}}');
  });

  it('defines defaults for every supported trigger and messaging action', () => {
    const triggers = Object.keys(DEFAULT_ACTION_CONTENT);
    expect(triggers).toContain('customer_birthday');
    expect(triggers).toContain('invoice_overdue');
    expect(triggers).toContain('payment_received');
    expect(triggers).toContain('review_request');
    expect(triggers).toContain('job_completed');
    expect(triggers).toContain('daily_sales_summary');
    expect(triggers).toContain('job_due_in_hours');
    for (const triggerType of triggers) {
      const actions = DEFAULT_ACTION_CONTENT[triggerType];
      expect(Object.keys(actions).length).toBeGreaterThan(0);
      for (const [actionType, content] of Object.entries(actions)) {
        expect(content, `${triggerType}/${actionType}`).toBeTruthy();
      }
      // job_due_in_hours targets assignees via email/task only
      if (triggerType !== 'job_due_in_hours') {
        for (const actionType of ['send_sms', 'send_whatsapp', 'send_email_platform']) {
          expect(actions[actionType], `${triggerType}/${actionType}`).toBeTruthy();
        }
      }
    }
  });
});

describe('automationForm frequency / schedule', () => {
  it('marks sticky triggers and defaults overdue to weekly', () => {
    expect(isStickyTrigger('invoice_overdue')).toBe(true);
    expect(isStickyTrigger('payment_received')).toBe(false);
    expect(defaultFrequencyForTrigger('invoice_overdue')).toBe('weekly');
    expect(defaultFrequencyForTrigger('low_stock_detected')).toBe('daily');
  });

  it('maps frequency form fields to scheduleConfig cooldownHours / maxSends', () => {
    expect(buildScheduleConfigFromForm({ frequency: 'once' }, 'invoice_overdue')).toEqual({
      frequency: 'once',
      maxSends: 1,
    });
    expect(buildScheduleConfigFromForm({ frequency: 'daily' }, 'invoice_overdue')).toEqual({
      frequency: 'daily',
      cooldownHours: 24,
    });
    expect(buildScheduleConfigFromForm({ frequency: 'weekly' }, 'invoice_overdue')).toEqual({
      frequency: 'weekly',
      cooldownHours: 168,
    });
    expect(buildScheduleConfigFromForm({ frequency: 'monthly' }, 'invoice_overdue')).toEqual({
      frequency: 'monthly',
      cooldownHours: 720,
    });
    expect(buildScheduleConfigFromForm({ frequency: 'every_n_days', intervalDays: '5' }, 'quote_no_response')).toEqual({
      frequency: 'every_n_days',
      intervalDays: 5,
      cooldownHours: 120,
    });
  });

  it('lazily normalizes empty sticky schedule to daily (overdue weekly)', () => {
    expect(scheduleFormFromConfig({}, 'invoice_overdue').frequency).toBe('daily');
    expect(scheduleFormFromConfig({}, 'customer_inactive_days').frequency).toBe('daily');
    expect(conditionFormFromConfig({}, { frequency: 'weekly', cooldownHours: 168 }, 'invoice_overdue').frequency).toBe('weekly');
    expect(defaultFrequencyForTrigger('invoice_overdue')).toBe('weekly');
  });

  it('includes scheduleConfig in buildRulePayloadFromForm', () => {
    const payload = buildRulePayloadFromForm({
      name: 'Overdue weekly',
      triggerType: 'invoice_overdue',
      triggerForm: { daysAfterDue: 1 },
      conditionForm: { frequency: 'weekly', intervalDays: '1' },
      actionRows: [{ type: 'send_email_platform', subject: 'Overdue', body: 'Pay now' }],
    });
    expect(payload.scheduleConfig).toEqual({ frequency: 'weekly', cooldownHours: 168 });
  });
});

describe('automationForm Send after / delayMinutes', () => {
  it('supports Send after on event triggers only', () => {
    expect(supportsSendAfter('review_request')).toBe(true);
    expect(supportsSendAfter('payment_received')).toBe(true);
    expect(supportsSendAfter('job_completed')).toBe(true);
    expect(supportsSendAfter('invoice_overdue')).toBe(false);
    expect(supportsSendAfter('customer_birthday')).toBe(false);
    expect(supportsSendAfter('daily_sales_summary')).toBe(false);
  });

  it('defaults review_request to 60 minutes and transactional to 0', () => {
    expect(defaultDelayMinutesForTrigger('review_request')).toBe(60);
    expect(defaultDelayMinutesForTrigger('payment_received')).toBe(0);
    expect(defaultDelayMinutesForTrigger('invoice_sent')).toBe(0);
  });

  it('maps delayMinutes into scheduleConfig for event triggers', () => {
    expect(buildScheduleConfigFromForm({ delayMinutes: '60' }, 'review_request')).toEqual({
      delayMinutes: 60,
    });
    expect(buildScheduleConfigFromForm({ delayMinutes: '3', cooldownDays: '7' }, 'payment_received')).toEqual({
      cooldownHours: 168,
      delayMinutes: 3,
    });
    expect(buildScheduleConfigFromForm({ delayMinutes: '60' }, 'invoice_overdue')).toEqual({
      frequency: 'weekly',
      cooldownHours: 168,
    });
  });

  it('round-trips delayMinutes through scheduleFormFromConfig', () => {
    expect(scheduleFormFromConfig({ delayMinutes: 60, cooldownHours: 168 }, 'review_request')).toMatchObject({
      delayMinutes: '60',
      cooldownDays: '7',
    });
    expect(conditionFormFromConfig({}, { delayMinutes: 60 }, 'review_request').delayMinutes).toBe('60');
  });

  it('includes delayMinutes in buildRulePayloadFromForm for review_request', () => {
    const payload = buildRulePayloadFromForm({
      name: 'Ask for review',
      triggerType: 'review_request',
      triggerForm: {},
      conditionForm: { delayMinutes: '60' },
      actionRows: [{ type: 'send_sms', body: 'Please review {{businessName}}' }],
    });
    expect(payload.scheduleConfig).toEqual({ delayMinutes: 60 });
  });
});

describe('automationForm review timing copy', () => {
  it('uses event-based copy for job_created, not a daily 09:00 schedule', () => {
    expect(usesDailySchedule('job_created')).toBe(false);
    expect(getEventTimingCopy('job_created', {})).toBe('Runs immediately when a job is created');
    expect(getEventTimingCopy('job_created', { delayMinutes: '0' })).toBe('Runs immediately when a job is created');
    expect(getEventTimingCopy('job_created', { delayMinutes: '60' })).toBe('Runs 1 hour after a job is created');
    expect(getReviewAdditionalSettingsLines('job_created', {})).toEqual([
      'Runs immediately when a job is created',
    ]);
    expect(getWhatHappensNextTiming('job_created', {}).title).toBe(
      'It will run immediately when a job is created'
    );
  });

  it('keeps daily schedule copy for sticky/scheduler triggers', () => {
    expect(usesDailySchedule('daily_sales_summary')).toBe(true);
    expect(usesDailySchedule('invoice_overdue')).toBe(true);
    expect(getReviewAdditionalSettingsLines('daily_sales_summary', { runAfterTime: '06:00' })).toEqual([
      'Time zone: (GMT+00:00) Accra',
      'Runs every day at 06:00 AM',
    ]);
    expect(getWhatHappensNextTiming('invoice_due_in_days', {}).title).toBe(
      'It will run every day at 09:00 AM'
    );
  });
});

describe('resolveAutomationBranchLabel', () => {
  const branches = {
    shops: [{ id: 'shop-1', name: 'Downtown shop' }],
    studioLocations: [{ id: 'loc-1', name: 'Uptown studio' }],
  };

  it('returns "All branches" when both branch fields are unset', () => {
    expect(resolveAutomationBranchLabel({}, branches)).toBe('All branches');
    expect(resolveAutomationBranchLabel({ shopId: null, studioLocationId: null }, branches)).toBe('All branches');
  });

  it('resolves the shop name when shopId matches', () => {
    expect(resolveAutomationBranchLabel({ shopId: 'shop-1' }, branches)).toBe('Downtown shop');
  });

  it('resolves the studio location name when studioLocationId matches', () => {
    expect(resolveAutomationBranchLabel({ studioLocationId: 'loc-1' }, branches)).toBe('Uptown studio');
  });

  it('falls back to "Unknown branch" when the id has no match in the list', () => {
    expect(resolveAutomationBranchLabel({ shopId: 'shop-missing' }, branches)).toBe('Unknown branch');
    expect(resolveAutomationBranchLabel({ studioLocationId: 'loc-missing' }, branches)).toBe('Unknown branch');
  });
});

