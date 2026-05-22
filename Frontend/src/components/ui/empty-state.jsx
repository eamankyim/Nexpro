import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { loadEmptyStateImage } from "../../config/emptyStateImages"
import { useResponsive } from "@/hooks/useResponsive"
import {
  Users,
  Briefcase,
  FileText,
  Package,
  ShoppingCart,
  Receipt,
  UserPlus,
  Truck,
  UserCog,
  Monitor,
  Layers,
  DollarSign,
  Pill,
  ClipboardList,
  Building2,
  Store,
  Calculator,
  BookOpen,
  Wallet,
  BarChart3,
  Bell,
  Search,
  WifiOff,
  Inbox,
  Clock,
  Paperclip,
  Building,
  Shield,
} from "lucide-react"

const iconMap = {
  Users,
  Briefcase,
  FileText,
  Package,
  ShoppingCart,
  Receipt,
  UserPlus,
  Truck,
  UserCog,
  Monitor,
  Layers,
  DollarSign,
  Pill,
  ClipboardList,
  Building2,
  Store,
  Calculator,
  BookOpen,
  Wallet,
  BarChart3,
  Bell,
  Search,
  WifiOff,
  Inbox,
  Clock,
  Paperclip,
  Building,
  Shield,
}

/**
 * EmptyState Component
 * 
 * A structured empty state component following UX best practices:
 * - Icon/visual to provide context
 * - Title explaining what's missing
 * - Description with guidance or next steps
 * - Primary CTA to resolve the empty state
 * - Optional secondary action for alternative paths
 * 
 * @example
 * <EmptyState
 *   icon="Users"
 *   title="No customers yet"
 *   description="Add your first customer to start tracking sales."
 *   primaryAction={{ label: "Add Customer", onClick: handleAdd }}
 *   secondaryAction={{ label: "Import CSV", onClick: handleImport }}
 * />
 */
/**
 * Loads empty-state illustration on demand.
 */
function EmptyStateImage({ imageKey, imageAlt, className }) {
  const [src, setSrc] = React.useState(null);

  React.useEffect(() => {
    if (!imageKey) return;
    let cancelled = false;
    loadEmptyStateImage(imageKey).then((url) => {
      if (!cancelled && url) setSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [imageKey]);

  if (!src) return null;

  return (
    <img
      src={src}
      alt={imageAlt}
      loading="lazy"
      decoding="async"
      className={className}
    />
  );
}

const EmptyState = React.forwardRef(({ 
  className,
  icon,
  image,
  imageKey,
  imageAlt = '',
  title,
  description,
  primaryAction,
  secondaryAction,
  children,
  size = "default",
  ...props 
}, ref) => {
  const { isMobile } = useResponsive()
  const IconComponent = typeof icon === 'string' ? iconMap[icon] : null
  const resolvedSize = size === "default" && isMobile ? "sm" : size
  const iconSize = resolvedSize === "sm" ? "h-8 w-8" : resolvedSize === "lg" ? "h-16 w-16" : "h-12 w-12"
  const imageMaxWidth =
    resolvedSize === "sm" ? "max-w-[220px]" : resolvedSize === "lg" ? "max-w-[320px]" : "max-w-[280px]"
  const titleSize = resolvedSize === "sm" ? "text-base" : resolvedSize === "lg" ? "text-xl" : "text-lg"
  const descSize = resolvedSize === "sm" ? "text-xs" : "text-sm"
  const padding = resolvedSize === "sm" ? "py-6" : resolvedSize === "lg" ? "py-16" : "py-12"

  return (
    <div
      ref={ref}
      className={cn(
        "flex flex-col items-center justify-center px-4 text-center",
        padding,
        className
      )}
      {...props}
    >
      {/* Illustration or icon */}
      {imageKey ? (
        <EmptyStateImage
          imageKey={imageKey}
          imageAlt={imageAlt}
          className={cn("mb-4 w-full h-auto object-contain", imageMaxWidth)}
        />
      ) : image ? (
        <img
          src={image}
          alt={imageAlt}
          loading="lazy"
          decoding="async"
          className={cn("mb-4 w-full h-auto object-contain", imageMaxWidth)}
        />
      ) : icon ? (
        <div className="mb-4 text-muted-foreground">
          {typeof icon === 'string' && IconComponent ? (
            <IconComponent className={cn(iconSize, "stroke-[1.5]")} />
          ) : (
            icon
          )}
        </div>
      ) : null}
      
      {/* Title */}
      {title && (
        <h3 className={cn("font-medium text-foreground", titleSize)}>
          {title}
        </h3>
      )}
      
      {/* Description */}
      {description && (
        <p className={cn("mt-1 text-muted-foreground max-w-sm", descSize)}>
          {description}
        </p>
      )}
      
      {/* Actions */}
      {(primaryAction || secondaryAction) && (
        <div className="mt-4 flex flex-wrap gap-2 justify-center">
          {primaryAction && (
            <Button 
              size={resolvedSize === "sm" ? "sm" : "default"}
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
            >
              {primaryAction.icon && <span className="mr-2">{primaryAction.icon}</span>}
              {primaryAction.label}
            </Button>
          )}
          {secondaryAction && (
            <Button 
              variant="outline"
              size={resolvedSize === "sm" ? "sm" : "default"}
              onClick={secondaryAction.onClick}
              disabled={secondaryAction.disabled}
            >
              {secondaryAction.icon && <span className="mr-2">{secondaryAction.icon}</span>}
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
      
      {/* Custom children content */}
      {children}
    </div>
  )
})

EmptyState.displayName = "EmptyState"

/**
 * Helper to get empty state config from EMPTY_STATES constant
 * @param {string} key - Key from EMPTY_STATES constant
 * @param {Object} actions - Object with primaryAction and secondaryAction handlers
 * @returns {Object} Props to spread into EmptyState
 */
export const getEmptyStateProps = (config, actions = {}) => {
  if (!config) return {}
  
  return {
    icon: config.imageKey ? undefined : config.icon,
    imageKey: config.imageKey,
    imageAlt: config.title ?? '',
    title: config.title,
    description: config.description,
    primaryAction: config.primaryAction && actions.primary ? {
      label: config.primaryAction,
      onClick: actions.primary,
    } : undefined,
    secondaryAction: config.secondaryAction && actions.secondary ? {
      label: config.secondaryAction,
      onClick: actions.secondary,
    } : undefined,
  }
}

export { EmptyState }
