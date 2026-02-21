import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
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
const EmptyState = React.forwardRef(({ 
  className,
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  children,
  size = "default",
  ...props 
}, ref) => {
  const IconComponent = typeof icon === 'string' ? iconMap[icon] : null
  const iconSize = size === "sm" ? "h-8 w-8" : size === "lg" ? "h-16 w-16" : "h-12 w-12"
  const titleSize = size === "sm" ? "text-base" : size === "lg" ? "text-xl" : "text-lg"
  const descSize = size === "sm" ? "text-xs" : "text-sm"
  const padding = size === "sm" ? "py-6" : size === "lg" ? "py-16" : "py-12"

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
      {/* Icon */}
      {icon && (
        <div className="mb-4 text-muted-foreground">
          {typeof icon === 'string' && IconComponent ? (
            <IconComponent className={cn(iconSize, "stroke-[1.5]")} />
          ) : (
            icon
          )}
        </div>
      )}
      
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
              size={size === "sm" ? "sm" : "default"}
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
              size={size === "sm" ? "sm" : "default"}
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
    icon: config.icon,
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
