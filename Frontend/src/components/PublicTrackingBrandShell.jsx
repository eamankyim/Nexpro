import { PackageSearch } from 'lucide-react';
import { DEFAULT_APP_PRIMARY_HEX } from '../utils/colors';

/**
 * Shared layout for public tracking pages: tenant brand color header/footer and logo circle.
 * The circle shows the tenant logo when set; otherwise a letter mark from the business name.
 */
function TenantLogoCircle({ logoUrl, name, accentColor, neutral }) {
  if (neutral) {
    return (
      <div
        className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/15 border border-white/30"
        aria-hidden
      >
        <PackageSearch className="h-7 w-7 text-white" />
      </div>
    );
  }

  const initial =
    (name || '')
      .trim()
      .match(/[a-zA-Z0-9]/)?.[0]
      ?.toUpperCase() || '?';

  return (
    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white p-2 border border-white/30">
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={name ? `${name} logo` : 'Business logo'}
          className="max-h-full max-w-full object-contain"
        />
      ) : (
        <span className="text-2xl font-bold tabular-nums" style={{ color: accentColor }} aria-hidden>
          {initial}
        </span>
      )}
    </div>
  );
}

/**
 * @param {object} props
 * @param {string} props.primaryColor - Tenant brand color (header/footer background)
 * @param {string} props.organizationName
 * @param {string} [props.logoUrl]
 * @param {import('react').ReactNode} [props.subtitle]
 * @param {import('react').ReactNode} [props.headerMeta] - e.g. "Updated …" line
 * @param {import('react').ReactNode} props.children
 * @param {string} [props.footerLabel]
 * @param {'brand' | 'neutral'} [props.variant] - neutral: same app green bars (error/loading), no tenant logo
 */
export function PublicTrackingBrandShell({
  variant = 'brand',
  primaryColor = DEFAULT_APP_PRIMARY_HEX,
  organizationName,
  logoUrl,
  subtitle,
  headerMeta,
  children,
  footerLabel = 'Powered by ABS'
}) {
  const isNeutral = variant === 'neutral';
  const barClass = 'px-6 py-8 text-center text-white';
  const barBackground = isNeutral ? DEFAULT_APP_PRIMARY_HEX : primaryColor;
  const barStyle = { backgroundColor: barBackground };

  return (
    <div className="flex min-h-screen flex-col bg-muted/40 p-8">
      <div className="mx-auto flex w-full max-w-[390px] flex-1 flex-col gap-4 min-h-0">
        <header
          className={`relative shrink-0 overflow-hidden rounded-2xl border border-border ${barClass}`}
          style={barStyle}
        >
          <div
            className="pointer-events-none absolute inset-0 rounded-2xl opacity-[0.14]"
            aria-hidden
            style={{
              backgroundImage: [
                'radial-gradient(ellipse 90% 70% at -5% -10%, rgba(255,255,255,0.95) 0%, transparent 50%)',
                'radial-gradient(ellipse 80% 60% at 105% 0%, rgba(255,255,255,0.9) 0%, transparent 48%)',
                'radial-gradient(ellipse 70% 55% at 100% 100%, rgba(255,255,255,0.85) 0%, transparent 45%)',
                'radial-gradient(ellipse 65% 50% at 0% 100%, rgba(255,255,255,0.8) 0%, transparent 42%)'
              ].join(', ')
            }}
          />
          <div className="relative z-[1] flex flex-col items-center text-center">
            <TenantLogoCircle
              logoUrl={isNeutral ? undefined : logoUrl}
              name={organizationName}
              accentColor={barBackground}
              neutral={isNeutral}
            />
            <h1 className={`mt-4 ${isNeutral ? 'text-xl font-semibold' : 'text-2xl font-bold'}`}>
              {organizationName || 'Track your request'}
            </h1>
            {subtitle ? <div className="mt-1 text-sm text-white/90">{subtitle}</div> : null}
            {headerMeta ? <div className="mt-2 text-[11px] text-white/80">{headerMeta}</div> : null}
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-white">
          {children}
        </div>

        <footer className="shrink-0 rounded-2xl border border-border py-3 text-center text-xs text-white" style={barStyle}>
          {footerLabel}
        </footer>
      </div>
    </div>
  );
}

export { TenantLogoCircle };
