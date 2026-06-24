import { describe, expect, it } from 'vitest';
import {
  OTHER_DROPDOWN_VALUE,
  collectResolvedCategories,
  hasUnresolvedOtherCategory,
  resolveOtherCategoryItems,
  resolveOtherDropdownValue,
} from '../../utils/customDropdownOther';

describe('customDropdownOther', () => {
  it('returns trimmed value when not Other sentinel', () => {
    expect(resolveOtherDropdownValue('Business Cards', '')).toBe('Business Cards');
    expect(resolveOtherDropdownValue('  Custom Work  ', '')).toBe('Custom Work');
  });

  it('resolves Other sentinel from custom text', () => {
    expect(resolveOtherDropdownValue(OTHER_DROPDOWN_VALUE, '  Embroidery  ')).toBe('Embroidery');
    expect(resolveOtherDropdownValue(OTHER_DROPDOWN_VALUE, '')).toBeNull();
    expect(resolveOtherDropdownValue(OTHER_DROPDOWN_VALUE, '   ')).toBeNull();
  });

  it('resolves Other categories on line items by index', () => {
    const items = [
      { category: 'Flyers', description: 'A5 flyers' },
      { category: OTHER_DROPDOWN_VALUE, description: 'Custom banners' },
    ];
    const resolved = resolveOtherCategoryItems(items, { 1: ' Vinyl Wrap ' });
    expect(resolved[0].category).toBe('Flyers');
    expect(resolved[1].category).toBe('Vinyl Wrap');
  });

  it('detects unresolved Other categories', () => {
    expect(hasUnresolvedOtherCategory([{ category: 'Other Services' }])).toBe(false);
    expect(hasUnresolvedOtherCategory([{ category: OTHER_DROPDOWN_VALUE }])).toBe(true);
    expect(hasUnresolvedOtherCategory(
      resolveOtherCategoryItems([{ category: OTHER_DROPDOWN_VALUE }], { 0: 'Labels' })
    )).toBe(false);
  });

  it('collects unique resolved categories', () => {
    expect(collectResolvedCategories([
      { category: 'Flyers' },
      { category: OTHER_DROPDOWN_VALUE },
      { category: 'Flyers' },
      { category: '  Banners  ' },
    ])).toEqual(['Flyers', 'Banners']);
  });
});
