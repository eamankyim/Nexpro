/**
 * Shared Online Store brand accent class tokens.
 * Resolve against TemplateThemeProvider CSS vars (`--store-accent`, etc.).
 * Fallbacks keep Sabito marketplace green when vars are unset.
 */

export const brandAccent = {
  text: 'text-[color:var(--store-accent,#166534)]',
  textStrong: 'text-[color:color-mix(in_srgb,var(--store-accent,#166534)_85%,black)]',
  textMuted: 'text-[color:color-mix(in_srgb,var(--store-accent,#166534)_72%,#0f172a)]',
  eyebrow: 'text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--store-accent,#166534)]',
  primaryBtn:
    'rounded-full bg-[var(--store-accent,#166534)] text-white hover:bg-[var(--store-accent-hover,color-mix(in_srgb,var(--store-accent,#166534)_85%,black))]',
  outlineBtn:
    'rounded-full border-[color:color-mix(in_srgb,var(--store-accent,#166534)_28%,white)] text-[color:var(--store-accent,#166534)] hover:bg-[var(--store-accent-soft,#16653422)] hover:text-[color:var(--store-accent,#166534)]',
  softIcon:
    'bg-[var(--store-accent-soft,#f0fdf4)] text-[color:color-mix(in_srgb,var(--store-accent,#166534)_85%,black)]',
  softBorder:
    'border-[color:color-mix(in_srgb,var(--store-accent,#166534)_22%,#e5e7eb)]',
  badge:
    'border-[color:color-mix(in_srgb,var(--store-accent,#166534)_18%,#e5e7eb)] bg-[var(--store-accent-soft,#f0fdf4)] capitalize text-[color:color-mix(in_srgb,var(--store-accent,#166534)_85%,black)]',
  hoverRow:
    'hover:border-[color:color-mix(in_srgb,var(--store-accent,#166534)_40%,#e2e8f0)] hover:bg-[var(--store-accent-soft,#f0fdf4)]',
  link: 'font-semibold text-[color:var(--store-accent,#166534)] hover:underline',
  focusRing: 'focus-visible:ring-[color:var(--store-accent,#166534)] focus:border-[color:var(--store-accent,#166534)]',
  softPanelStyle: {
    borderColor: 'color-mix(in srgb, var(--store-accent, #166534) 22%, #e5e7eb)',
    backgroundColor: 'var(--store-accent-soft, #f0fdf4)',
  },
};

export default brandAccent;
