import { Shield, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import OverviewMetricIconBadge from './OverviewMetricIconBadge';

/**
 * Overall business health status footer bar.
 */
export default function BusinessHealthFooter({ health, onViewReport }) {
  const isGood = health?.status === 'good';
  const isCritical = health?.status === 'critical';

  return (
    <div className={cn(
      'rounded-lg border p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3',
      isCritical ? 'border-red-200 bg-red-50' : isGood ? 'border-primary/30 bg-primary/5' : 'border-amber-200 bg-amber-50'
    )}>
      <div className="flex items-start gap-3">
        {isGood ? (
          <OverviewMetricIconBadge icon={Shield} bgColor="#dcfce7" iconColor="#166534" />
        ) : (
          <OverviewMetricIconBadge
            icon={ShieldAlert}
            bgColor={isCritical ? '#fee2e2' : '#ffedd5'}
            iconColor={isCritical ? '#b91c1c' : '#c2410c'}
          />
        )}
        <div>
          <p className="text-sm font-semibold text-foreground">Overall Business Health</p>
          <p className="text-sm text-muted-foreground">{health?.message}</p>
        </div>
      </div>
      {onViewReport && (
        <Button
          variant="outline"
          className="shrink-0 border-border bg-card"
          onClick={onViewReport}
        >
          View Business Health Report
        </Button>
      )}
    </div>
  );
}
