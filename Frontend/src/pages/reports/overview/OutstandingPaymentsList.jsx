import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { OVERVIEW_CARD_BORDER, formatOverviewCurrency } from './overviewUtils';

/**
 * List of overdue outstanding payments.
 */
export default function OutstandingPaymentsList({ invoices = [], onViewAll }) {
  return (
    <Card style={OVERVIEW_CARD_BORDER} className="bg-card h-full">
      <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base font-semibold">Outstanding Payments</CardTitle>
        {onViewAll && (
          <Button variant="link" className="h-auto p-0 text-xs text-primary" onClick={onViewAll}>
            View All Invoices
          </Button>
        )}
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {invoices.length > 0 ? (
          <div className="space-y-3">
            {invoices.map((inv) => (
              <div key={inv.id} className="flex items-start justify-between gap-2 border-b border-border pb-3 last:border-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{inv.customerName}</p>
                  <p className="text-xs text-red-700">Overdue {inv.daysOverdue} day{inv.daysOverdue !== 1 ? 's' : ''}</p>
                </div>
                <span className="text-sm font-semibold text-foreground shrink-0">
                  {formatOverviewCurrency(inv.amount)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-10 text-center text-sm text-muted-foreground">No overdue payments</div>
        )}
      </CardContent>
    </Card>
  );
}
