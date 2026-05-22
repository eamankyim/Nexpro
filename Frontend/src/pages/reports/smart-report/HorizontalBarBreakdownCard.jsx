import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { OVERVIEW_CARD_BORDER, formatOverviewCurrency } from '../overview/overviewUtils';

/**
 * Horizontal bar breakdown list (cash inflow/outflow sources).
 */
export default function HorizontalBarBreakdownCard({
  title,
  items = [],
  viewLabel,
  emptyMessage = 'No data for this period',
}) {
  const maxValue = Math.max(...items.map((i) => Math.abs(i.value || 0)), 1);

  return (
    <Card style={OVERVIEW_CARD_BORDER} className="bg-card h-full">
      <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        {viewLabel && (
          <Button variant="link" className="h-auto p-0 text-xs text-primary">
            {viewLabel}
          </Button>
        )}
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {items.length > 0 ? (
          <div className="space-y-4">
            {items.map((item) => {
              const widthPct = (Math.abs(item.value || 0) / maxValue) * 100;
              return (
                <div key={item.name}>
                  <div className="flex items-center justify-between text-sm mb-1.5 gap-2">
                    <span className="text-muted-foreground truncate">{item.name}</span>
                    <span className="font-medium text-foreground shrink-0">
                      {formatOverviewCurrency(item.value)}
                      {item.percent != null && (
                        <span className="text-muted-foreground font-normal ml-1">({item.percent.toFixed(1)}%)</span>
                      )}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${widthPct}%`, backgroundColor: item.color || '#166534' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-16 text-center text-sm text-muted-foreground">{emptyMessage}</div>
        )}
      </CardContent>
    </Card>
  );
}
