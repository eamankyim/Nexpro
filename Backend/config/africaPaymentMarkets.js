/**
 * Supported mobile-money markets and operators (product + API alignment).
 * Used for validation messages, docs, and future provider expansion.
 * Prefixes are national significant digits after country code (e.g. 233 + 24 → MTN Ghana).
 */

const AFRICA_MOMO_MARKETS = [
  {
    countryCode: 'GH',
    currency: 'GHS',
    dialCode: '233',
    label: 'Ghana',
    operators: [
      { code: 'MTN', label: 'MTN Mobile Money', prefixes: ['24', '54', '55', '59'] },
      { code: 'AIRTEL', label: 'AirtelTigo Money', prefixes: ['26', '27', '57'] },
      { code: 'VODAFONE', label: 'Vodafone Cash', prefixes: ['20', '50'], apiReady: false }
    ]
  },
  {
    countryCode: 'UG',
    currency: 'UGX',
    dialCode: '256',
    label: 'Uganda',
    operators: [
      { code: 'MTN', label: 'MTN Mobile Money', prefixes: ['77', '78', '76'] },
      { code: 'AIRTEL', label: 'Airtel Money', prefixes: ['70', '75'] }
    ]
  },
  {
    countryCode: 'KE',
    currency: 'KES',
    dialCode: '254',
    label: 'Kenya',
    operators: [{ code: 'AIRTEL', label: 'Airtel Money', prefixes: ['73', '78'] }]
  }
];

/** ISO country codes where direct MoMo collection APIs are in scope */
const MOMO_COLLECTION_COUNTRY_CODES = ['GH', 'UG', 'KE'];

module.exports = {
  AFRICA_MOMO_MARKETS,
  MOMO_COLLECTION_COUNTRY_CODES
};
