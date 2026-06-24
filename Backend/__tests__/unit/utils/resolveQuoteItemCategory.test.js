const { resolveQuoteItemCategory } = require('../../../utils/resolveQuoteItemCategory');

describe('resolveQuoteItemCategory', () => {
  it('prefers metadata.category over description', () => {
    expect(resolveQuoteItemCategory({
      description: 'Line item text',
      metadata: { category: 'Embroidery' },
    })).toBe('Embroidery');
  });

  it('falls back to description when metadata category is missing', () => {
    expect(resolveQuoteItemCategory({
      description: 'Business cards',
      metadata: {},
    })).toBe('Business cards');
  });

  it('ignores __OTHER__ sentinel in metadata', () => {
    expect(resolveQuoteItemCategory({
      description: 'Custom banners',
      metadata: { category: '__OTHER__' },
    })).toBe('Custom banners');
  });
});
