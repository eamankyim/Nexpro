import { memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { useHintMode } from '@/context/HintModeContext';
import { cn } from '@/lib/utils';

/**
 * DashboardStatsCard - Reusable dashboard statistics card component
 * @param {string} [tooltip] - Optional tooltip text on hover
 * @param {string} title - Card title
 * @param {string|number} value - Main value to display
 * @param {string} valuePrefix - Prefix for value (e.g., '₵ ')
 * @param {React.ReactNode} prefix - Optional prefix (e.g. icon) before value
 * @param {string} suffix - Optional suffix after value (e.g. ' seats')
 * @param {React.ReactNode} icon - Icon component
 * @param {string} iconBgColor - Background color for icon circle
 * @param {string} iconColor - Color for icon
 * @param {React.ReactNode} comparisonText - Comparison text (e.g., "↑ ₵ 100 vrs yesterday")
 * @param {string} comparisonColor - Color for comparison text
 * @param {'up'|'down'|'neutral'} trend - Trend direction for trendValue
 * @param {string} trendValue - Trend value to display (e.g. "+12%")
 * @param {string} className - Optional class for value/container styling
 * @param {string} subtitle - Optional subtitle (alias for comparisonText, shown below value)
 */
const DashboardStatsCard = memo(({
  tooltip,
  title,
  value,
  valuePrefix = '',
  prefix,
  suffix = '',
  icon: Icon,
  iconBgColor,
  iconColor,
  comparisonText,
  subtitle,
  comparisonColor = '#166534',
  trend,
  trendValue,
  className
}) => {
  const { hintMode } = useHintMode();
  const displayComparison = comparisonText ?? subtitle;
  const formattedValue = typeof value === 'number' 
    ? Number.isInteger(value)
      ? value.toLocaleString('en-US')
      : value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : value;

  const trendDisplay = trend && trendValue;
  const trendColorClass = trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-muted-foreground';
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : ArrowRight;

  const card = (
    <Card className={cn("dashboard-stats-card rounded-xl border-border", className)}>
      <CardContent className={cn("p-2")}>
        <div className="flex justify-between items-start gap-2">
          <div className={cn("text-xs md:text-sm text-muted-foreground font-bold min-w-0")}>{title}</div>
          {(Icon || trendDisplay) ? (
            <div className="flex items-center gap-1 shrink-0">
              {trendDisplay && (
                <span className={cn("text-xs font-medium flex items-center gap-1", trendColorClass)}>
                  {trend === 'up' && <TrendingUp className="h-3.5 w-3.5 shrink-0" />}
                  {trend === 'down' && <TrendingDown className="h-3.5 w-3.5 shrink-0" />}
                  {trendValue}
                </span>
              )}
              {Icon && iconBgColor && (
                <div 
                  className="rounded-full flex items-center justify-center w-8 h-8 md:w-10 md:h-10 p-1.5"
                  style={{ backgroundColor: iconBgColor }}
                >
                  <Icon className="h-4 w-4 md:h-5 md:w-5 shrink-0" style={{ color: iconColor }} />
                </div>
              )}
            </div>
          ) : null}
        </div>
        <div>
          <div className={cn("text-xl md:text-2xl lg:text-3xl font-bold text-foreground leading-tight")}>
            {prefix}
            {valuePrefix}{formattedValue}{suffix}
          </div>
        </div>
        {displayComparison && (
          <div 
            className={cn("text-[10px] md:text-xs flex items-center gap-1 font-medium")}
            style={{ color: comparisonColor }}
          >
            {trend && <TrendIcon className="h-3.5 w-3.5 shrink-0" />}
            {displayComparison}
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(hintMode && "cursor-help")}>{card}</div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    );
  }
  return card;
});

DashboardStatsCard.displayName = 'DashboardStatsCard';

export default DashboardStatsCard;
