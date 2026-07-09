import { describe, it, expect } from 'vitest';
import {
  DEFAULT_ACTION_CONTENT,
  defaultActionFormRow,
  formatPlaceholderHint,
  prefillActionRow,
  prefillActionRows,
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
  });

  it('defines defaults for every supported trigger and messaging action', () => {
    const triggers = Object.keys(DEFAULT_ACTION_CONTENT);
    expect(triggers).toContain('customer_birthday');
    expect(triggers).toContain('invoice_overdue');
    for (const triggerType of triggers) {
      for (const actionType of ['send_sms', 'send_whatsapp', 'send_email_platform']) {
        const content = DEFAULT_ACTION_CONTENT[triggerType][actionType];
        expect(content, `${triggerType}/${actionType}`).toBeTruthy();
      }
    }
  });
});
