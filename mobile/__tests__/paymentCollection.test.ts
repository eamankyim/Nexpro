import {
  getDirectMomoProviders,
  isValidDirectMomoPhone,
  normalizeDirectMomoPhone,
} from '@/utils/paymentCollection';

describe('payment collection utilities', () => {
  it.each([
    ['024 123 4567', '233241234567'],
    ['+233241234567', '233241234567'],
    ['233241234567', '233241234567'],
    ['241234567', '233241234567'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeDirectMomoPhone(input)).toBe(expected);
  });

  it('validates Ghana mobile money phone numbers', () => {
    expect(isValidDirectMomoPhone('024 123 4567')).toBe(true);
    expect(isValidDirectMomoPhone('+233241234567')).toBe(true);
    expect(isValidDirectMomoPhone('12345')).toBe(false);
  });

  it('only returns direct MoMo providers when collection is configured', () => {
    expect(getDirectMomoProviders(null)).toEqual([]);
    expect(getDirectMomoProviders({ configured: true })).toEqual(['MTN', 'AIRTEL', 'VODAFONE']);
    expect(getDirectMomoProviders({ mtn_collection: { merchantId: 'M1' } })).toEqual([
      'MTN',
      'AIRTEL',
      'VODAFONE',
    ]);
    expect(getDirectMomoProviders({ hubtel_collection: { configured: true } })).toEqual([
      'MTN',
      'AIRTEL',
      'VODAFONE',
    ]);
  });
});
