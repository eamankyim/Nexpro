/**
 * Whether ABS subscription pricing / plan-checkout UI is shown.
 * Off by default — set VITE_SHOW_PRICING=true (or 1) to show again.
 * Backend billing is unaffected; this is UI-only.
 * @returns {boolean}
 */
export function isPricingUiEnabled() {
  const raw = import.meta.env.VITE_SHOW_PRICING?.trim().toLowerCase();
  return raw === 'true' || raw === '1';
}
