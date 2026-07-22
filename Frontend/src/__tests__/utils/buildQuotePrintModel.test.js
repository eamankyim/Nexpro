import { describe, it, expect } from 'vitest';
import {
  buildQuotePrintModel,
  resolveQuoteTemplateKind,
  DEFAULT_STUDIO_QUOTE_TERMS,
} from '../../utils/buildQuotePrintModel';

describe('buildQuotePrintModel', () => {
  it('resolves shop/pharmacy as product and studios as project', () => {
    expect(resolveQuoteTemplateKind('shop')).toBe('product');
    expect(resolveQuoteTemplateKind('pharmacy')).toBe('product');
    expect(resolveQuoteTemplateKind('printing_press')).toBe('project');
    expect(resolveQuoteTemplateKind('salon')).toBe('project');
  });

  it('builds a project quotation without product code or balance due', () => {
    const model = buildQuotePrintModel({
      quoteNumber: 'Q-1',
      title: 'Website redesign',
      description: 'Full redesign',
      status: 'sent',
      subtotal: 1000,
      totalAmount: 1000,
      items: [{ description: 'Design', quantity: 1, unitPrice: 1000, total: 1000 }],
      scopeOfWork: 'Discovery, design, handoff',
      paymentSchedule: [{ label: 'Advance', percent: 20, amount: 200 }],
      showClientAcceptance: true,
    }, { businessType: 'printing_press' });

    expect(model.templateKind).toBe('project');
    expect(model.documentTitle).toBe('QUOTATION');
    expect(model.sections.items.showProductCode).toBe(false);
    expect(model.sections.totals.showBalanceDue).toBe(false);
    expect(model.sections.scopeOfWork).toBe(true);
    expect(model.sections.paymentSchedule).toBe(true);
    expect(model.sections.clientAcceptance).toBe(true);
    expect(model.data.termsBullets.length).toBeGreaterThan(0);
    expect(model.data.termsBullets).toEqual(DEFAULT_STUDIO_QUOTE_TERMS);
  });

  it('builds a product quotation that keeps product code and hides balance due', () => {
    const model = buildQuotePrintModel({
      quoteNumber: 'Q-2',
      title: 'Bulk order',
      subtotal: 50,
      totalAmount: 50,
      items: [{ description: 'Item', quantity: 2, unitPrice: 25, total: 50, product: { sku: 'SKU-1' } }],
    }, { businessType: 'shop' });

    expect(model.templateKind).toBe('product');
    expect(model.documentTitle).toBe('PROFORMA INVOICE');
    expect(model.sections.items.showProductCode).toBe(true);
    expect(model.sections.totals.showBalanceDue).toBe(false);
    expect(model.sections.clientAcceptance).toBe(false);
    expect(model.invoicePayload.invoiceNumber).toBe('Q-2');
  });
});
