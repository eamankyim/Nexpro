import { describe, it, expect } from 'vitest';
import {
  buildPreviewContextFromForm,
  formatPreviewDate,
  getSampleDueDateIso,
  resolveAutomationTemplatePreview,
  resolveWhatsAppParametersPreview,
} from '../../utils/automationTemplatePreview';
import { buildTestContextFromForm } from '../../utils/automationForm';

describe('automationTemplatePreview', () => {
  const baseForm = {
    name: 'Test rule',
    triggerType: 'invoice_due_in_days',
    triggerForm: { daysBeforeDue: 2 },
    conditionForm: {},
    actionRows: [{ type: 'send_sms', body: '' }],
  };

  it('resolves simple and nested placeholders', () => {
    const context = {
      customerName: 'John Doe',
      businessName: 'Kofi Prints',
      invoice: { invoiceNumber: 'INV-1', dueDate: '2026-08-15' },
    };
    expect(
      resolveAutomationTemplatePreview(
        'Hi {{customerName}}, invoice {{invoiceNumber}} from {{businessName}}',
        context
      )
    ).toBe('Hi John Doe, invoice INV-1 from Kofi Prints');
    expect(resolveAutomationTemplatePreview('Ref {{invoice.invoiceNumber}}', context)).toBe('Ref INV-1');
    expect(resolveAutomationTemplatePreview('Due {{dueDate}}', context)).toBe('Due 15 Aug 2026');
  });

  it('uses real businessName in preview context', () => {
    const context = buildPreviewContextFromForm({
      ...baseForm,
      businessName: 'Acme Pharmacy Osu',
    });
    expect(context.businessName).toBe('Acme Pharmacy Osu');
    expect(context.customerName).toBe('John Doe');
    expect(context.invoiceNumber).toBe('INV-SAMPLE-0001');
    expect(context.balance).toMatch(/^GHS /);
    expect(context.dueDate).toMatch(/^\d{1,2} \w{3} \d{4}$/);
    expect(context.invoice?.dueDate).toBe(context.dueDate);
  });

  it('resolves invoice due SMS template with sample values', () => {
    const context = buildPreviewContextFromForm({
      ...baseForm,
      businessName: 'Kofi Prints',
      actionRows: [
        {
          type: 'send_sms',
          body:
            'Hi {{customerName}}, kindly note invoice {{invoiceNumber}} for {{balance}} is due on {{dueDate}}. Pay here: {{paymentLink}} — {{businessName}}',
        },
      ],
    });
    const resolved = resolveAutomationTemplatePreview(
      'Hi {{customerName}}, kindly note invoice {{invoiceNumber}} for {{balance}} is due on {{dueDate}}. Pay here: {{paymentLink}} — {{businessName}}',
      context
    );
    expect(resolved).toContain('Hi John Doe');
    expect(resolved).toContain('INV-SAMPLE-0001');
    expect(resolved).toContain('GHS');
    expect(resolved).toContain('Kofi Prints');
    expect(resolved).toContain('https://pay.example.com/invoice/sample');
    expect(resolved).toMatch(/is due on \d{1,2} \w{3} \d{4}\./);
    expect(resolved).not.toMatch(/is due on \./);
  });

  it('includes formatted dueDate for invoice_overdue preview', () => {
    const context = buildPreviewContextFromForm({
      ...baseForm,
      triggerType: 'invoice_overdue',
      triggerForm: { daysAfterDue: 3 },
    });
    const sampleIso = getSampleDueDateIso('invoice_overdue', { daysAfterDue: 3 });
    expect(context.dueDate).toBe(formatPreviewDate(sampleIso));
    expect(
      resolveAutomationTemplatePreview('Invoice was due on {{dueDate}}', context)
    ).toContain(context.dueDate);
  });

  it('resolves comma-separated WhatsApp parameters including dueDate', () => {
    const context = buildPreviewContextFromForm({
      ...baseForm,
      businessName: 'Kofi Prints',
    });
    expect(
      resolveWhatsAppParametersPreview(
        '{{customerName}}, {{invoiceNumber}}, {{balance}}, {{dueDate}}',
        context
      )
    ).toEqual([
      'John Doe',
      'INV-SAMPLE-0001',
      expect.stringMatching(/^GHS /),
      expect.stringMatching(/^\d{1,2} \w{3} \d{4}$/),
    ]);
  });

  it('buildTestContextFromForm sets trigger-aware sample due dates', () => {
    const dueSoon = buildTestContextFromForm({
      ...baseForm,
      triggerType: 'invoice_due_in_days',
      triggerForm: { daysBeforeDue: 5 },
    });
    const overdue = buildTestContextFromForm({
      ...baseForm,
      triggerType: 'invoice_overdue',
      triggerForm: { daysAfterDue: 4 },
    });
    const dueSoonDate = new Date(dueSoon.dueDate);
    const overdueDate = new Date(overdue.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expect(dueSoonDate.getTime()).toBeGreaterThanOrEqual(today.getTime());
    expect(overdueDate.getTime()).toBeLessThanOrEqual(today.getTime());
  });
});
