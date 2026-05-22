import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { OVERVIEW_CARD_BORDER, formatOverviewCurrency } from './overviewUtils';

/**
 * Compact profit and loss summary panel.
 */
export default function ProfitLossSummaryCard({ profitLoss, onViewFullReport }) {
  const revenue = parseFloat(profitLoss?.revenue || 0);
  const expenses = parseFloat(profitLoss?.expenses || 0);
  const cogs = parseFloat(profitLoss?.cogs || 0);
  const grossProfit = parseFloat(profitLoss?.grossProfit ?? (revenue - cogs));
  const netProfit = parseFloat(profitLoss?.netProfit ?? (revenue - expenses));
  const netMargin = revenue > 0 ? ((netProfit / revenue) * 100).toFixed(1) : '0.0';

  const rows = [
    { label: 'Total Revenue', value: revenue },
    { label: 'COGS', value: cogs },
    { label: 'Gross Profit', value: grossProfit, bold: true },
    { label: 'Total Expenses', value: expenses },
    { label: 'Net Profit', value: netProfit, bold: true, highlight: true },
    { label: 'Net Profit Margin', value: `${netMargin}%`, isText: true }
  ];

  return (
    <Card style={OVERVIEW_CARD_BORDER} className="bg-card h-full">
      <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base font-semibold">Profit and Loss Summary</CardTitle>
        {onViewFullReport && (
          <Button variant="link" className="h-auto p-0 text-xs text-primary" onClick={onViewFullReport}>
            View Full P&amp;L Report
          </Button>
        )}
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="space-y-0">
          {rows.map((row, idx) => (
            <div key={row.label}>
              <div className="flex justify-between items-center py-2.5">
                <span className={`text-sm ${row.bold ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                  {row.label}
                </span>
                <span className={`text-sm ${row.highlight ? 'font-bold text-primary' : row.bold ? 'font-semibold' : ''}`}>
                  {row.isText ? row.value : formatOverviewCurrency(row.value)}
                </span>
              </div>
              {idx < rows.length - 1 && <Separator />}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
