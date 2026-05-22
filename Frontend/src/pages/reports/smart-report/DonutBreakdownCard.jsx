import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { OVERVIEW_CARD_BORDER, formatOverviewCurrency } from '../overview/overviewUtils';

/**
 * Reusable donut breakdown card (revenue, expenses, payment methods).
 */
export default function DonutBreakdownCard({
  title,
  slices = [],
  total,
  centerLabel = 'Total',
  formatCenterValue,
  onViewAnalysis,
  viewLabel = 'View Analysis',
  emptyMessage = 'No data for this period',
}) {
  const computedTotal = total ?? slices.reduce((s, i) => s + (i.value || 0), 0);
  const centerDisplay = formatCenterValue
    ? formatCenterValue(computedTotal)
    : formatOverviewCurrency(computedTotal);

  return (
    <Card style={OVERVIEW_CARD_BORDER} className="bg-card h-full">
      <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        {onViewAnalysis && (
          <Button variant="link" className="h-auto p-0 text-xs text-primary" onClick={onViewAnalysis}>
            {viewLabel}
          </Button>
        )}
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {slices.length > 0 ? (
          <>
            <div className="relative">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={slices}
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={78}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {slices.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatOverviewCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xs text-muted-foreground">{centerLabel}</span>
                <span className="text-sm font-bold text-foreground">{centerDisplay}</span>
              </div>
            </div>
            <div className="space-y-2 mt-2">
              {slices.map((item) => {
                const pct = computedTotal > 0 ? ((item.value / computedTotal) * 100).toFixed(1) : '0.0';
                return (
                  <div key={item.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-muted-foreground truncate">{item.name}</span>
                    </div>
                    <span className="font-medium text-foreground ml-2">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="py-16 text-center text-sm text-muted-foreground">{emptyMessage}</div>
        )}
      </CardContent>
    </Card>
  );
}
