import { describe, it, expect } from 'vitest';
import { TRIGGER_OPTIONS } from '../../utils/automationForm';
import {
  filterTriggerOptionsForTenant,
  isTriggerAllowedForTenant,
  resolveBusinessType,
} from '../../utils/automationBusinessType';

describe('automationBusinessType (frontend)', () => {
  it('resolves printing_press to studio', () => {
    expect(resolveBusinessType('printing_press')).toBe('studio');
  });

  it('filters TRIGGER_OPTIONS so studio does not see low_stock', () => {
    const studio = { businessType: 'studio', metadata: {} };
    const options = filterTriggerOptionsForTenant(TRIGGER_OPTIONS, studio);
    const values = options.map((o) => o.value);
    expect(values).not.toContain('low_stock_detected');
    expect(values).not.toContain('low_stock_on_change');
    expect(values).not.toContain('out_of_stock_detected');
    expect(values).not.toContain('daily_sales_summary');
    expect(values).toContain('job_completed');
    expect(values).toContain('invoice_due_in_days');
  });

  it('allows low_stock for shop tenants', () => {
    const shop = { businessType: 'shop', metadata: { shopType: 'supermarket' } };
    expect(isTriggerAllowedForTenant('low_stock_detected', shop)).toBe(true);
    expect(isTriggerAllowedForTenant('order_created', shop)).toBe(false);
  });

  it('allows order_created for restaurant shops only', () => {
    const restaurant = { businessType: 'shop', metadata: { shopType: 'restaurant' } };
    expect(isTriggerAllowedForTenant('order_created', restaurant)).toBe(true);
    expect(isTriggerAllowedForTenant('quote_sent', restaurant)).toBe(false);
  });
});
