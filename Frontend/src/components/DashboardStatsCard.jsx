import { memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * DashboardStatsCard - Reusable dashboard statistics card component
 * @param {string} title - Card title
 * @param {string|number} value - Main value to display
 * @param {string} valuePrefix - Prefix for value (e.g., 'GHS ')
 * @param {React.ReactNode} icon - Icon component
 * @param {string} iconBgColor - Background color for icon circle
 * @param {string} iconColor - Color for icon
 * @param {React.ReactNode} comparisonText - Comparison text (e.g., "↑ GHS 100 vrs yesterday")
 * @param {string} comparisonColor - Color for comparison text
 */
const DashboardStatsCard = memo(({
  title,
  value,
  valuePrefix = '',
  icon: Icon,
  iconBgColor,
  iconColor,
  comparisonText,
  comparisonColor = '#166534'
}) => {
  const formattedValue = typeof value === 'number' 
    ? Number.isInteger(value)
      ? value.toLocaleString('en-US')
      : value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : value;

  return (
    <Card
      className="dashboard-stats-card"
      style={{
        borderRadius: 12,
        border: '1px solid #e5e7eb',
        backgroundColor: 'white'
      }}
    >
      <CardContent className={cn("p-1.5 md:p-2")}>
        <div className="flex justify-between items-start">
          <div className={cn("text-xs md:text-sm text-gray-600 font-bold")}>{title}</div>
          <div 
            className={cn("rounded-full flex items-center justify-center w-8 h-8 md:w-10 md:h-10")}
            style={{ backgroundColor: iconBgColor }}
          >
            {Icon && <Icon className="h-4 w-4 md:h-5 md:w-5" style={{ color: iconColor }} />}
          </div>
        </div>
        <div>
          <div className={cn("text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 leading-tight")}>
            {valuePrefix}{formattedValue}
          </div>
        </div>
        {comparisonText && (
          <div 
            className={cn("text-[10px] md:text-xs flex items-center gap-1 font-medium")}
            style={{ color: comparisonColor }}
          >
            {comparisonText}
          </div>
        )}
      </CardContent>
    </Card>
  );
});

DashboardStatsCard.displayName = 'DashboardStatsCard';

export default DashboardStatsCard;
