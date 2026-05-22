import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { OVERVIEW_CARD_BORDER, formatOverviewCurrency } from './overviewUtils';

/**
 * Horizontal bar summary for cash flow.
 */
export default function CashFlowSummaryCard({ cashFlow, onViewFullReport }) {
  const inflow = parseFloat(cashFlow?.operating?.cashReceivedFromCustomers || 0);
  const outflow = parseFloat(cashFlow?.operating?.cashPaidToSuppliersAndExpenses || 0);
  const net = parseFloat(cashFlow?.netChangeInCash ?? cashFlow?.operating?.netCashFromOperatingActivities ?? (inflow - outflow));
  const maxVal = Math.max(inflow, outflow, 1);

  const bars = [
    { label: 'Cash Inflow', value: inflow, color: 'var(--color-primary)' },
    { label: 'Cash Outflow', value: outflow, color: '#b91c1c' },
    { label: 'Net Cash Flow', value: net, color: net >= 0 ? 'var(--color-primary)' : '#b91c1c' }
  ];

  return (
    <Card style={OVERVIEW_CARD_BORDER} className="bg-card h-full">
      <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base font-semibold">Cash Flow Summary</CardTitle>
        {onViewFullReport && (
          <Button variant="link" className="h-auto p-0 text-xs text-primary" onClick={onViewFullReport}>
            View Cash Flow Report
          </Button>
        )}
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-4">
        {bars.map((bar) => (
          <div key={bar.label}>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">{bar.label}</span>
              <span className="font-medium">{formatOverviewCurrency(bar.value)}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, (Math.abs(bar.value) / maxVal) * 100)}%`,
                  backgroundColor: bar.color
                }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
