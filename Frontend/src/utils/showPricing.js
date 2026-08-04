/**
 * In-app ABS billing / plans / checkout UI is always available.
 * Public marketing pricing is gated separately via
 * marketing-site `NEXT_PUBLIC_SHOW_PRICING` (see lib/featureFlags.ts).
 * @returns {boolean}
 */
export function isPricingUiEnabled() {
  return true;
}
