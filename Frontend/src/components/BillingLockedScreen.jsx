import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { CreditCard, Headphones, Lock, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const BRAND_GREEN = '#166534';

/**
 * Full-workspace block when billing is locked (managers can reach plans, checkout, and settings).
 */
const BillingLockedScreen = ({ billing }) => {
  const trialEnded = billing?.lockReason === 'trial_expired';
  const graceEnded = billing?.graceEndsAt ? dayjs().isAfter(dayjs(billing.graceEndsAt)) : true;

  const description = trialEnded
    ? 'Your free trial has ended and the grace period is over. Renew your subscription to continue using all features.'
    : graceEnded
      ? 'Your workspace subscription is not active. Renew your subscription to continue using all features.'
      : 'Renew your subscription to continue using all features.';

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4 bg-muted/30">
      <Card className="max-w-md w-full rounded-xl border border-border bg-card">
        <CardContent className="px-8 pb-8 pt-10 text-center">
          <div className="relative mx-auto mb-6 h-16 w-16">
            <span
              className="absolute -left-1 top-2 h-1.5 w-1.5 rounded-full opacity-40"
              style={{ backgroundColor: BRAND_GREEN }}
              aria-hidden
            />
            <span
              className="absolute -right-0.5 top-0 h-2 w-2 rounded-full opacity-30"
              style={{ backgroundColor: BRAND_GREEN }}
              aria-hidden
            />
            <span
              className="absolute bottom-1 right-0 h-1.5 w-1.5 rounded-full opacity-35"
              style={{ backgroundColor: BRAND_GREEN }}
              aria-hidden
            />
            <span
              className="absolute bottom-3 left-0 h-1 w-1 rounded-full opacity-25"
              style={{ backgroundColor: BRAND_GREEN }}
              aria-hidden
            />
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full"
              style={{ backgroundColor: 'color-mix(in srgb, #166534 12%, transparent)' }}
            >
              <Lock className="h-7 w-7" style={{ color: BRAND_GREEN }} strokeWidth={2} />
            </div>
          </div>

          <h1 className="text-xl font-semibold tracking-tight text-foreground">Subscription required</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{description}</p>

          <div className="mt-8 flex flex-col gap-3">
            <Button
              asChild
              className={cn(
                'h-11 w-full rounded-lg text-base font-medium',
                'bg-[#166534] text-white hover:bg-[#14532d] hover:text-white'
              )}
            >
              <Link to="/plans" className="text-white hover:text-white">
                <CreditCard className="mr-2 h-4 w-4 shrink-0" />
                Renew subscription
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              className={cn(
                'h-11 w-full rounded-lg text-base font-medium',
                'border-[#166534] bg-background text-[#166534]',
                'hover:border-[#166534] hover:bg-[#166534] hover:text-white'
              )}
            >
              <Link
                to="/settings?tab=billing"
                className="text-[#166534] hover:text-white focus:text-white"
              >
                <Settings className="mr-2 h-4 w-4 shrink-0" />
                Billing settings
              </Link>
            </Button>
          </div>

          <div className="mt-8 border-t border-border pt-6">
            <div className="flex items-start gap-3 text-left">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: 'color-mix(in srgb, #166534 12%, transparent)' }}
              >
                <Headphones className="h-5 w-5" style={{ color: BRAND_GREEN }} />
              </div>
              <div className="min-w-0 pt-0.5">
                <p className="text-sm font-semibold text-foreground">Need help?</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Contact{' '}
                  <a
                    href="mailto:support@africanbusinesssuite.com"
                    className="font-semibold hover:underline"
                    style={{ color: BRAND_GREEN }}
                  >
                    support
                  </a>{' '}
                  from your account email.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BillingLockedScreen;
