export const STORAGE_KEYS = {
  token: 'sabito_buyer_token',
  customer: 'sabito_buyer_customer',
  cart: 'sabito_buyer_cart',
  checkoutIntent: 'sabito_buyer_checkout_intent',
  onboardingComplete: 'sabito_buyer_onboarding_complete',
} as const;

export const BRAND = {
  name: 'Sabito Store',
  primary: '#166534',
  primaryLight: '#22c55e',
  background: '#f8fafc',
  text: '#0f172a',
  muted: '#64748b',
  border: '#e2e8f0',
  danger: '#dc2626',
  warning: '#d97706',
} as const;

export const DEFAULT_CURRENCY = 'GHS';

export const GHANA_REGIONS = [
  'Greater Accra',
  'Ashanti',
  'Western',
  'Central',
  'Eastern',
  'Northern',
  'Volta',
  'Upper East',
  'Upper West',
  'Bono',
  'Bono East',
  'Ahafo',
  'Western North',
  'Oti',
  'Savannah',
  'North East',
] as const;
