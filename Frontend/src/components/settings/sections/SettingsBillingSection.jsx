import { useNavigate } from 'react-router-dom';
import { CalendarDays, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import StatusChip from '../../StatusChip';
import { useSettingsBilling } from '../../../hooks/useSettingsBilling';

/**
 * ABS subscription plan, seats, and payment history.
 */
const SettingsBillingSection = () => {
  const navigate = useNavigate();
  const {
    canManageOrganization,
    loadingSubscription,
    loadingSubscriptionPayments,
    subscriptionPlanLabel,
    subscriptionStatus,
    isTrialSubscription,
    currentPeriodEndDate,
    teamSeatsLabel,
    subscriptionPayments,
    activeSubscriptionPayment,
    formatLabel,
    formatMinorCurrency,
  } = useSettingsBilling();

  if (!canManageOrganization) {
    return (
      <Card className="border border-gray-200">
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <AlertTitle>Access Restricted</AlertTitle>
            <AlertDescription>
              You need admin or manager permissions to view billing settings.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-gray-200">
      <CardHeader>
        <CardTitle className="text-lg md:text-xl">Subscription Billing</CardTitle>
        <CardDescription>
          Manage what this workspace pays ABS for plan access, seats, and renewals.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="border-t pt-5">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_1fr_1.35fr] md:divide-x">
            <div className="space-y-3 md:pr-8">
              <p className="text-sm font-medium text-muted-foreground">Plan</p>
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-xl font-semibold tracking-tight">{subscriptionPlanLabel}</h4>
                <StatusChip
                  status={subscriptionStatus}
                  className={['active', 'trialing'].includes(subscriptionStatus)
                    ? 'border-green-100 bg-green-50 text-green-700'
                    : undefined}
                />
                {loadingSubscription && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {currentPeriodEndDate
                  ? `${isTrialSubscription ? 'Trial ends' : 'Renews'} on ${currentPeriodEndDate.format('MMMM D, YYYY')}`
                  : 'No renewal date set'}
              </p>
              {isTrialSubscription && (
                <Button
                  type="button"
                  variant="outline"
                  className="border-green-700 text-green-700 hover:bg-green-700 hover:text-white"
                  onClick={() => navigate('/plans')}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Upgrade plan
                </Button>
              )}
            </div>

            <div className="space-y-3 md:px-8">
              <p className="text-sm font-medium text-muted-foreground">Team Seats</p>
              <p className="text-xl font-semibold tracking-tight">{teamSeatsLabel}</p>
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 font-semibold text-green-700 hover:text-green-800"
                onClick={() => navigate('/users')}
              >
                Manage seats
              </Button>
            </div>

            <div className="flex items-start justify-between gap-4 md:pl-8">
              <div className="space-y-3">
                <p className="text-sm font-medium text-muted-foreground">Current Period Ends</p>
                <p className="text-xl font-semibold tracking-tight">
                  {currentPeriodEndDate ? currentPeriodEndDate.format('MMMM D, YYYY') : 'Not set'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isTrialSubscription
                    ? 'Auto-calculated (30 days for trial plans)'
                    : 'Based on your current billing period'}
                </p>
              </div>
              <div className="rounded-lg bg-green-50 p-3 text-green-700">
                <CalendarDays className="h-5 w-5" />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border p-4 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold">Payments to ABS</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Subscription billing payments this workspace made to ABS for plan access, seats, and renewals.
              </p>
            </div>
            {activeSubscriptionPayment ? (
              <div className="rounded-md border border-green-100 bg-green-50 px-3 py-2 text-xs text-green-700">
                Active through{' '}
                {activeSubscriptionPayment.periodEnd
                  ? new Date(activeSubscriptionPayment.periodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : 'current period'}
              </div>
            ) : null}
          </div>

          {loadingSubscriptionPayments ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptionPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground text-center py-6">
                      No ABS subscription payments recorded for this workspace yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  subscriptionPayments.map((payment) => (
                    <TableRow key={payment.id || payment.providerReference || `${payment.plan}-${payment.periodStart}`}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {payment.periodStart ? new Date(payment.periodStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not set'}
                        {' - '}
                        {payment.periodEnd ? new Date(payment.periodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not set'}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{formatLabel(payment.plan)}</div>
                        <div className="text-xs text-muted-foreground">{formatLabel(payment.billingPeriod)}</div>
                      </TableCell>
                      <TableCell className="capitalize">{payment.provider || 'manual'}</TableCell>
                      <TableCell>
                        <StatusChip status={payment.status || 'success'} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMinorCurrency(payment.amount, payment.currency)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default SettingsBillingSection;
