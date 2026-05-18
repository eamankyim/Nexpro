import { PackageSearch, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DEFAULT_APP_PRIMARY_HEX, PUBLIC_PAGE_HERO_GREEN, PUBLIC_PAGE_SURFACE_BG } from '../utils/colors';

/**
 * @param {{ logoUrl?: string, name: string, accentColor: string, neutral?: boolean, size?: 'md' | 'lg' }} props
 */
function TenantLogoCircle({ logoUrl, name, accentColor, neutral, size = 'lg' }) {
  const dim = size === 'lg' ? 'h-20 w-20 sm:h-[5.5rem] sm:w-[5.5rem]' : 'h-16 w-16';

  if (neutral) {
    return (
      <div
        className={cn(
          'mx-auto flex items-center justify-center rounded-full border border-white/30 bg-white/15',
          dim
        )}
        aria-hidden
      >
        <PackageSearch className="h-8 w-8 text-white sm:h-9 sm:w-9" />
      </div>
    );
  }

  const initial =
    (name || '')
      .trim()
      .match(/[a-zA-Z0-9]/)?.[0]
      ?.toUpperCase() || '?';

  return (
    <div
      className={cn(
        'mx-auto flex items-center justify-center rounded-full border border-white/40 bg-white p-2.5',
        dim
      )}
    >
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={name ? `${name} logo` : 'Business logo'}
          className="max-h-full max-w-full object-contain"
        />
      ) : (
        <span className="text-3xl font-bold tabular-nums sm:text-4xl" style={{ color: accentColor }} aria-hidden>
          {initial}
        </span>
      )}
    </div>
  );
}

/**
 * Shared layout for public customer pages (review, job/order tracking): hero band, optional card body, footer.
 * Uses the public mock palette (forest hero, light page background). No drop shadows — borders only.
 *
 * @param {object} props
 * @param {string} [props.primaryColor] - Reserved for future tenant-tinted accents (hero uses public green).
 * @param {string} props.organizationName - Used for logo fallback and screen readers when `heroTitle` is set.
 * @param {string} [props.logoUrl]
 * @param {string} [props.heroTitle] - Main headline in the hero (defaults to `organizationName`).
 * @param {string} [props.heroTagline] - Subline under the headline (alias: `subtitle`).
 * @param {import('react').ReactNode} [props.subtitle] - Same as `heroTagline` for backward compatibility.
 * @param {import('react').ReactNode} [props.headerMeta]
 * @param {import('react').ReactNode} [props.headerActions] - e.g. Support pill (absolute top-right).
 * @param {import('react').ReactNode} [props.children]
 * @param {import('react').ReactNode} [props.preFooter] - Content between main body and powered-by bar.
 * @param {string} [props.footerLabel]
 * @param {'minimal' | 'hero'} [props.footerStyle] - `minimal`: muted text on page background (track mock). `hero`: green pill bar matching the header.
 * @param {'brand' | 'neutral'} [props.variant] - Brand uses public green hero; neutral uses app primary.
 * @param {'card' | 'plain'} [props.contentMode] - `card`: white rounded panel; `plain`: stack sections (tracking hub).
 * @param {boolean} [props.headerAllowOverlap] - When true, removes gap below header and adds bottom padding so the first stacked card can use negative margin to overlap the hero (tracking hub).
 */
export function PublicTrackingBrandShell({
  variant = 'brand',
  primaryColor: _primaryColor,
  organizationName,
  logoUrl,
  heroTitle,
  heroTagline,
  subtitle,
  headerMeta,
  headerActions,
  children,
  preFooter,
  footerLabel = 'Powered by ABS',
  footerStyle = 'minimal',
  contentMode = 'card',
  logoSize = 'lg',
  headerAllowOverlap = false,
}) {
  const isNeutral = variant === 'neutral';
  const barBackground = isNeutral ? DEFAULT_APP_PRIMARY_HEX : PUBLIC_PAGE_HERO_GREEN;
  const footerIsHeroBand = footerStyle === 'hero';
  const taglineNode = heroTagline ?? subtitle;
  const headline = heroTitle || organizationName || 'Track your request';

  return (
    <div className="flex min-h-screen flex-col" style={{ backgroundColor: PUBLIC_PAGE_SURFACE_BG }}>
      <div
        className={cn(
          'mx-auto flex w-full max-w-[420px] flex-col px-3 py-3 sm:px-4 sm:py-4',
          headerAllowOverlap ? 'gap-0' : 'gap-2 sm:gap-3'
        )}
      >
        <header
          className={cn(
            'relative z-0 shrink-0 overflow-hidden rounded-2xl border border-white/15 px-4 pt-7 text-center text-white sm:px-5 sm:pt-8',
            headerAllowOverlap ? 'pb-12 sm:pb-14' : 'pb-7 sm:pb-8'
          )}
          style={{ backgroundColor: barBackground }}
        >
          <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-2xl" aria-hidden>
            <div
              className="absolute left-2 top-2 h-28 w-32 opacity-[0.45] sm:left-3 sm:top-3"
              style={{
                backgroundImage:
                  'radial-gradient(circle at center, rgba(230,244,234,0.95) 1.5px, transparent 1.5px)',
                backgroundSize: '10px 10px',
              }}
            />
            <svg
              className="absolute -right-1 top-0 h-28 w-32 text-[#bfe8cc] sm:h-32 sm:w-36"
              viewBox="0 0 140 90"
              fill="none"
              aria-hidden
            >
              <path
                d="M4 18C32 52 72 8 118 22"
                stroke="currentColor"
                strokeWidth="7"
                strokeLinecap="round"
              />
              <path
                d="M24 58C52 38 88 72 132 48"
                stroke="currentColor"
                strokeWidth="5"
                strokeLinecap="round"
                opacity="0.65"
              />
            </svg>
          </div>

          {headerActions ? (
            <div className="absolute right-2.5 top-2.5 z-[2] sm:right-3 sm:top-3">{headerActions}</div>
          ) : null}

          <div className="relative z-[1] flex flex-col items-center text-center">
            <TenantLogoCircle
              logoUrl={isNeutral ? undefined : logoUrl}
              name={organizationName}
              accentColor={PUBLIC_PAGE_HERO_GREEN}
              neutral={isNeutral}
              size={logoSize}
            />
            <h1 className="mt-4 max-w-[18rem] text-xl font-bold leading-snug sm:mt-5 sm:max-w-none sm:text-2xl">
              {headline}
            </h1>
            {taglineNode ? <div className="mt-1.5 max-w-[20rem] text-sm leading-relaxed text-white/90">{taglineNode}</div> : null}
            {headerMeta ? <div className="mt-1.5 text-[11px] text-white/75">{headerMeta}</div> : null}
          </div>
        </header>

        {contentMode === 'card' ? (
          <div className="flex flex-col overflow-hidden rounded-2xl border border-[#e4e4e7] bg-white">
            {children}
          </div>
        ) : (
          <div
            className={cn(
              'flex flex-col',
              headerAllowOverlap ? 'gap-1.5' : 'gap-2 sm:gap-3'
            )}
          >
            {children}
          </div>
        )}

        {preFooter}

        <footer
          className={cn(
            'flex shrink-0 flex-col items-center justify-center gap-1 text-center',
            footerIsHeroBand
              ? 'rounded-2xl border border-white/15 py-2.5 text-xs font-medium text-white/95 sm:py-3'
              : 'py-3 text-[11px] font-medium text-muted-foreground sm:py-4',
            headerAllowOverlap ? 'mt-1.5' : 'mt-1'
          )}
          style={footerIsHeroBand ? { backgroundColor: barBackground } : undefined}
        >
          <div className="flex items-center gap-1.5">
            <Shield
              className={cn('h-3.5 w-3.5 shrink-0', footerIsHeroBand ? 'opacity-90' : 'opacity-70')}
              aria-hidden
            />
            <span>{footerLabel}</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

export { TenantLogoCircle };
