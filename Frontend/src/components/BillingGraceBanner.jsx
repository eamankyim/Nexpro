import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

/**
 * Shown when workspace is in billing grace (trial or subscription ended, still has access).
 */
const BillingGraceBanner = ({ billing }) => {
  if (!billing || billing.billingStatus !== 'grace') return null;

  const endsAt = billing.graceEndsAt ? dayjs(billing.graceEndsAt) : null;
  const daysLeft = billing.daysRemaining ?? (endsAt ? endsAt.diff(dayjs(), 'day') : null);
  const reason =
    billing.lockReason === 'trial_expired'
      ? 'Your free trial has ended.'
      : 'Your subscription period has ended.';

  return (
    <Alert className="mx-4 sm:mx-4 lg:mx-6 mt-2 border-amber-600/50 bg-amber-500/10">
      <AlertTriangle className="h-4 w-4 text-amber-700" />
      <AlertTitle className="text-amber-900 dark:text-amber-100">Renew to keep access</AlertTitle>
      <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <span className="text-sm text-muted-foreground">
          {reason}{' '}
          {daysLeft != null ? (
            <>
              You have <strong>{daysLeft}</strong> day{daysLeft === 1 ? '' : 's'} left before the workspace is
              locked.
            </>
          ) : (
            <>Renew soon to avoid interruption.</>
          )}
        </span>
        <Button asChild size="sm" className="shrink-0 bg-[#166534] hover:bg-[#14532d]">
          <Link to="/checkout">Renew plan</Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
};

export default BillingGraceBanner;
