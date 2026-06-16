export function isPaymentCollectionConfigured(paymentCollection: unknown): boolean {
  if (!paymentCollection || typeof paymentCollection !== 'object') return false;
  const pc = paymentCollection as Record<string, unknown>;
  const settlementType = pc.settlement_type ?? pc.settlementType;
  const hasMomoDetails = Boolean(
    pc.momo_phone_masked ?? pc.momoPhone ?? pc.momo_provider ?? pc.momoProvider
  );

  return Boolean(
    pc.hasSubaccount === true ||
    pc.configured === true ||
    (settlementType === 'momo' && hasMomoDetails)
  );
}

export type DirectMomoProvider = 'MTN' | 'AIRTEL' | 'VODAFONE';

export const DIRECT_MOMO_PROVIDERS: Array<{ value: DirectMomoProvider; label: string }> = [
  { value: 'MTN', label: 'MTN Mobile Money' },
  { value: 'AIRTEL', label: 'AirtelTigo Money' },
  { value: 'VODAFONE', label: 'Telecel Cash' },
];

export function getDirectMomoProviders(paymentCollection: unknown): DirectMomoProvider[] {
  if (!isPaymentCollectionConfigured(paymentCollection)) return [];
  return DIRECT_MOMO_PROVIDERS.map((provider) => provider.value);
}

export function normalizeDirectMomoPhone(phoneNumber: string): string {
  const raw = String(phoneNumber || '').replace(/[^\d+]/g, '');
  if (!raw) return '';
  if (raw.startsWith('+233')) return raw.slice(1);
  if (raw.startsWith('233')) return raw;
  if (raw.startsWith('0')) return `233${raw.slice(1)}`;
  if (/^\d{9}$/.test(raw)) return `233${raw}`;
  return raw.replace(/^\+/, '');
}

export function isValidDirectMomoPhone(phoneNumber: string): boolean {
  return /^233\d{9}$/.test(normalizeDirectMomoPhone(phoneNumber));
}
