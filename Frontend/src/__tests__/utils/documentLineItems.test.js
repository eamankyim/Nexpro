import { describe, expect, it } from 'vitest';
import {
  formatDocumentQuantity,
  formatLineItemQuantity,
  getLineItemUnitSymbol,
} from '../../utils/documentLineItems';

describe('documentLineItems', () => {
  it('returns unit symbol from item fields', () => {
    expect(getLineItemUnitSymbol({ unit: 'pcs' })).toBe('pcs');
    expect(getLineItemUnitSymbol({ metadata: { unit: 'sqm' } })).toBe('sqm');
    expect(getLineItemUnitSymbol({ product: { unit: 'kg' } })).toBe('kg');
    expect(getLineItemUnitSymbol({ pricingMethod: 'square_foot' })).toBe('sq ft');
    expect(getLineItemUnitSymbol({})).toBe('');
  });

  it('formats quantity with unit when available', () => {
    expect(formatDocumentQuantity(1, 'sqm')).toBe('1 (sqm)');
    expect(formatDocumentQuantity(2.5, 'kg')).toBe('2.5 (kg)');
    expect(formatDocumentQuantity(5, '')).toBe('5');
  });

  it('formats line item quantity from item data', () => {
    expect(formatLineItemQuantity({ quantity: 5, unit: 'pcs' })).toBe('5 (pcs)');
    expect(formatLineItemQuantity({ quantity: 10, unit: 'sqm' })).toBe('10 (sqm)');
    expect(formatLineItemQuantity({ quantity: 1 })).toBe('1');
  });

  it('formats decimal quantities with unit', () => {
    expect(formatLineItemQuantity({ quantity: 10.5, unit: 'sqm' })).toBe('10.5 (sqm)');
  });
});
