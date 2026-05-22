import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { OVERVIEW_CARD_BORDER, formatOverviewCurrency, formatPercentChange } from './overviewUtils';
import OverviewMetricIconBadge from './OverviewMetricIconBadge';

/**
 * Secondary KPI card for customer and AR metrics.
 */
export default function OverviewSecondaryKpiCard({
  label,
  value,
  valueFormatter,
  change,
  comparisonLabel,
  highlightNegative = false,
  icon: Icon,
  iconBgColor = '#dcfce7',
  iconColor = '#166534'
}) {
  const displayValue = valueFormatter ? valueFormatter(value) : formatOverviewCurrency(value);
  const changeNum = Number(change) || 0;
  const isPositive = changeNum >= 0;
  const isNeutral = changeNum === 0;
  const TrendIcon = isNeutral ? Minus : isPositive ? TrendingUp : TrendingDown;

  return (
    <Card style={OVERVIEW_CARD_BORDER} className="bg-card">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="text-xs text-muted-foreground">{label}</p>
          <OverviewMetricIconBadge icon={Icon} bgColor={iconBgColor} iconColor={iconColor} />
        </div>
        <p className={cn(
          'text-lg font-bold mb-2',
          highlightNegative && Number(value) > 0 ? 'text-red-700' : 'text-foreground'
        )}>
          {displayValue}
        </p>
        <div className="flex items-center gap-1">
          <TrendIcon
            className={cn(
              'h-3 w-3 shrink-0',
              isNeutral ? 'text-muted-foreground' : isPositive ? 'text-green-700' : 'text-red-700'
            )}
            aria-hidden
          />
          <span className={cn(
            'text-xs',
            isNeutral ? 'text-muted-foreground' : isPositive ? 'text-green-700' : 'text-red-700'
          )}>
            {formatPercentChange(changeNum)} {comparisonLabel || 'vs previous period'}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
