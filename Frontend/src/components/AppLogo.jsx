import { cn } from '@/lib/utils';
import { APP_LOGO_ALT, APP_LOGO_SRC } from '@/config/appBrand';
import { useBranding } from '@/context/BrandingContext';

/**
 * Product / workspace logo image.
 * @param {object} props
 * @param {string} [props.src] - Override (e.g. tenant logo URL)
 * @param {string} [props.alt]
 * @param {string} [props.className]
 * @param {string} [props.imageClassName]
 */
export default function AppLogo({
  src,
  alt = APP_LOGO_ALT,
  className,
  imageClassName,
}) {
  return (
    <img
      src={src || APP_LOGO_SRC}
      alt={alt}
      className={cn('object-contain flex-shrink-0', className, imageClassName)}
      decoding="async"
    />
  );
}

/**
 * Auth screens: logo with optional app name beside it.
 */
export function AuthBrandMark({
  appName: appNameProp,
  showName = true,
  logoClassName = 'h-10 w-10 sm:h-12 sm:w-12',
  className,
  nameClassName = 'text-2xl sm:text-3xl font-bold text-brand',
}) {
  const { appName: brandedName } = useBranding();
  const appName = appNameProp ?? brandedName ?? APP_LOGO_ALT;

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <AppLogo className={logoClassName} alt={appName} />
      {showName ? <span className={nameClassName}>{appName}</span> : null}
    </div>
  );
}
