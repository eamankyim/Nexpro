import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { CreditCard, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Full-workspace block when billing is locked (managers can reach checkout/settings).
 */
const BillingLockedScreen = ({ billing }) => {
  const trialEnded = billing?.lockReason === 'trial_expired';
  const graceEnded = billing?.graceEndsAt ? dayjs().isAfter(dayjs(billing.graceEndsAt)) : true;

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <Card className="max-w-lg w-full border border-border">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Lock className="h-6 w-6 text-muted-foreground" />
          </div>
          <CardTitle>Subscription required</CardTitle>
          <CardDescription>
            {trialEnded
              ? 'Your free trial has ended and the grace period is over.'
              : graceEnded
                ? 'Your workspace subscription is not active.'
                : 'Renew your plan to continue using ABS.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button asChild className="w-full bg-[#166534] hover:bg-[#14532d]">
            <Link to="/checkout">
              <CreditCard className="h-4 w-4 mr-2" />
              Renew subscription
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link to="/settings?tab=billing">Billing settings</Link>
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            Need help? Contact support from your account email.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default BillingLockedScreen;
