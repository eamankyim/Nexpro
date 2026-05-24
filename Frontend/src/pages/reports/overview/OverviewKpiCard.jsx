import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { OVERVIEW_CARD_BORDER, formatOverviewCurrency, formatPercentChange } from './overviewUtils';
import OverviewMetricIconBadge from './OverviewMetricIconBadge';

/**
 * Primary KPI card with icon badge, sparkline, and period comparison.
 */
export default function OverviewKpiCard({
  label,
  value,
  valueFormatter,
  change,
  comparisonLabel,
  sparklineData = [],
  SparklineChart,
  valueClassName,
  invertTrend = false,
  hideTrend = false,
  subLabel,
  sourceLabel,
  icon: Icon,
  iconBgColor = '#dcfce7',
  iconColor = '#166534'
}) {
  const displayValue = valueFormatter ? valueFormatter(value) : formatOverviewCurrency(value);
  const changeNum = Number(change) || 0;
  const isPositive = invertTrend ? changeNum <= 0 : changeNum >= 0;
  const isNeutral = changeNum === 0;
  const sparkline = sparklineData.length > 0 ? sparklineData : [0];

  const TrendIcon = isNeutral ? Minus : isPositive ? TrendingUp : TrendingDown;

  return (
    <Card style={OVERVIEW_CARD_BORDER} className="bg-card">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="text-xs text-muted-foreground">{label}</p>
          <OverviewMetricIconBadge icon={Icon} bgColor={iconBgColor} iconColor={iconColor} />
        </div>
        <p className={cn('text-xl font-bold text-foreground mb-2', valueClassName)}>{displayValue}</p>
        {subLabel ? (
          <p className="text-xs text-muted-foreground mb-3">{subLabel}</p>
        ) : !hideTrend && (
          <div className="flex items-center gap-1 mb-3">
            <TrendIcon
              className={cn(
                'h-3.5 w-3.5 shrink-0',
                isNeutral ? 'text-muted-foreground' : isPositive ? 'text-green-700' : 'text-red-700'
              )}
              aria-hidden
            />
            <span className={cn(
              'text-xs font-medium',
              isNeutral ? 'text-muted-foreground' : isPositive ? 'text-green-700' : 'text-red-700'
            )}>
              {formatPercentChange(changeNum)} {comparisonLabel || 'vs previous period'}
            </span>
          </div>
        )}
        {SparklineChart && (
          <div className="h-10 w-full min-h-[40px]">
            <SparklineChart data={sparkline} positive={isPositive} />
          </div>
        )}
        {sourceLabel && (
          <p className="text-[11px] text-muted-foreground mt-2">{sourceLabel}</p>
        )}
      </CardContent>
    </Card>
  );
}
