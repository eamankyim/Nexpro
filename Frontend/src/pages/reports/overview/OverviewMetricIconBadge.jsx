import { cn } from '@/lib/utils';

/**
 * Colored square icon badge used on overview KPI cards (matches mockup).
 */
export default function OverviewMetricIconBadge({ icon: Icon, bgColor, iconColor, className }) {
  if (!Icon) return null;

  return (
    <div
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/60',
        className
      )}
      style={{ backgroundColor: bgColor }}
    >
      <Icon className="h-4 w-4 shrink-0" style={{ color: iconColor }} aria-hidden />
    </div>
  );
}
