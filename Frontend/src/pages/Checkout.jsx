import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  CreditCard,
  CheckCircle,
  ArrowLeft,
  Loader2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import settingsService from '../services/settingsService';
import authService from '../services/authService';
import { API_BASE_URL } from '../services/api';
import { showSuccess, showError } from '../utils/toast';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
const planNames = {
  starter: 'Starter',
  professional: 'Professional',
  enterprise: 'Enterprise'
};

const DEFAULT_MONTHLY = { starter: 129, professional: 250, enterprise: null };
const DEFAULT_YEARLY_TOTAL = { starter: 1188, professional: 2388, enterprise: null };
const DEFAULT_YEARLY_PER_MONTH = {
  starter: Math.round((1188 / 12) * 100) / 100,
  professional: Math.round((2388 / 12) * 100) / 100,
};

const Checkout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user, refreshAuthState, needsEmailVerification } = useAuth();
  const [verifying, setVerifying] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [verified, setVerified] = useState(false);
  const verifyStartedRef = useRef(false);

  const initialData = location.state || {};
  const plan = initialData.plan;
  const billingPeriod = initialData.billingPeriod || 'yearly';
  const [planPricing, setPlanPricing] = useState({
    monthly: { ...DEFAULT_MONTHLY },
    yearlyTotal: { ...DEFAULT_YEARLY_TOTAL },
    yearlyPerMonth: { ...DEFAULT_YEARLY_PER_MONTH },
  });

  useEffect(() => {
    let cancelled = false;
    const base = API_BASE_URL ? `${API_BASE_URL}/api` : '/api';
    fetch(`${base}/public/pricing?channel=marketing`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled || !json?.success || !Array.isArray(json.data)) return;
        const monthly = { ...DEFAULT_MONTHLY };
        const yearlyTotal = { ...DEFAULT_YEARLY_TOTAL };
        const yearlyPerMonth = { ...DEFAULT_YEARLY_PER_MONTH };
        json.data.forEach((row) => {
          const id = row.id;
          const amount = row.priceMeta?.amount;
          if (amount == null || !['starter', 'professional'].includes(id)) return;
          if (row.interval === 'monthly') monthly[id] = amount;
          if (row.interval === 'annually') {
            yearlyTotal[id] = amount;
            yearlyPerMonth[id] = Math.round((amount / 12) * 100) / 100;
          }
        });
        setPlanPricing({ monthly, yearlyTotal, yearlyPerMonth });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const finalPrice =
    billingPeriod === 'yearly' && plan !== 'enterprise'
      ? planPricing.yearlyTotal[plan]
      : planPricing.monthly[plan];
  const yearlyPerMonth = planPricing.yearlyPerMonth[plan];
  const isEnterprise = plan === 'enterprise';

  const reference = searchParams.get('reference');
  const hasValidSelection =
    ['starter', 'professional'].includes(plan) &&
    ['monthly', 'yearly'].includes(billingPeriod);

  useEffect(() => {
    if (!reference && !hasValidSelection) {
      navigate('/plans', { replace: true });
    }
  }, [reference, hasValidSelection, navigate]);

  const verifyMutation = useMutation({
    mutationFn: (ref) => settingsService.verifySubscriptionPayment(ref),
    onSuccess: () => {
      setVerified(true);
      showSuccess('Payment successful! Your subscription is now active.');
      queryClient.invalidateQueries({ queryKey: ['settings', 'subscription'] });
      queryClient.invalidateQueries({ queryKey: ['subscription', 'status'] });
      queryClient.invalidateQueries({ queryKey: ['subscription', 'payments'] });
      setTimeout(() => navigate('/settings?tab=subscription'), 2000);
    },
    onError: (error) => {
      showError(error, error?.response?.data?.message || 'Payment verification failed');
      setVerifying(false);
    }
  });

  const payMutation = useMutation({
    mutationFn: (payload) => settingsService.initializeSubscriptionPayment(payload),
    onSuccess: (result) => {
      const url = result?.data?.authorization_url;
      if (url) {
        window.location.href = url;
      } else {
        showError(null, result?.message || 'Failed to initialize payment');
      }
    },
    onError: (error) => {
      showError(error, error?.response?.data?.message || 'Failed to initialize payment');
    }
  });

  useEffect(() => {
    if (reference && !verifyStartedRef.current) {
      verifyStartedRef.current = true;
      setVerifying(true);
      verifyMutation.mutate(reference);
    }
  }, [reference]);

  const handleResendVerification = useCallback(async () => {
    setResendLoading(true);
    try {
      await authService.resendVerification();
      showSuccess('Verification email sent. Check your inbox.');
      await refreshAuthState();
    } catch (err) {
      showError(err, err?.response?.data?.message || 'Failed to send.');
    } finally {
      setResendLoading(false);
    }
  }, [refreshAuthState]);

  const handlePay = useCallback(() => {
    if (!plan || !billingPeriod || isEnterprise) return;
    payMutation.mutate({ plan, billingPeriod });
  }, [plan, billingPeriod, isEnterprise, payMutation]);

  if (!reference && !hasValidSelection) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  if (!reference && user && needsEmailVerification) {
    return (
      <div className="min-h-screen overflow-y-auto">
        <div className="max-w-md mx-auto p-4 md:p-6 flex flex-col items-center justify-center min-h-[300px] gap-4 text-center">
          <h2 className="text-xl font-semibold">Verify your email to upgrade your plan</h2>
          <p className="text-muted-foreground text-sm">
            We need to verify your email before you can subscribe. Check your inbox for the verification link, or resend it below.
          </p>
          <Button
            onClick={handleResendVerification}
            disabled={resendLoading}
            className="bg-brand hover:bg-brand-dark text-white"
          >
            {resendLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Resend verification email
          </Button>
          <Button variant="outline" onClick={() => navigate('/dashboard')}>
            Back to dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (reference) {
    return (
      <div className="min-h-screen overflow-y-auto">
        <div className="max-w-5xl mx-auto p-4 md:p-6 flex flex-col items-center justify-center min-h-[300px] gap-4">
          {verifying || verifyMutation.isPending ? (
            <>
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-muted-foreground">Verifying your payment...</p>
            </>
          ) : verified ? (
            <>
              <CheckCircle className="h-16 w-16 text-green-600" />
              <h2 className="text-xl font-semibold">Payment Successful!</h2>
              <p className="text-muted-foreground">Redirecting to settings...</p>
            </>
          ) : (
            <Alert variant="destructive" className="max-w-md">
              <AlertTitle>Verification failed</AlertTitle>
              <AlertDescription>
                <Button
                  variant="outline"
                  onClick={() => navigate('/settings?tab=subscription')}
                  className="mt-2"
                >
                  Back to Settings
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-y-auto">
      <div className="max-w-5xl mx-auto p-4 md:p-6 pb-12">
      <Button
        variant="ghost"
        onClick={() => navigate(-1)}
        className="mb-6 min-h-[44px]"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back
      </Button>

      <h1 className="text-2xl md:text-3xl font-bold mb-2">Checkout</h1>
      <p className="text-muted-foreground mb-6 text-sm md:text-base">
        Review your selected plan and complete your subscription upgrade.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-[40%_60%] gap-6">
        <Card className="border border-gray-200">
          <CardHeader>
            <CardTitle>Order Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="font-semibold">Plan:</span>
                <span>{planNames[plan]}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold">Billing:</span>
                <span>{billingPeriod === 'yearly' ? 'Yearly' : 'Monthly'}</span>
              </div>
              {billingPeriod === 'yearly' && !isEnterprise && (
                <div className="flex justify-between text-green-600">
                  <span>Discount:</span>
                  <span>₵ {yearlyPerMonth}/mo</span>
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold">Total:</span>
                {isEnterprise ? (
                  <span className="text-lg font-medium text-muted-foreground">Contact sales</span>
                ) : (
                  <span className="text-2xl font-bold text-primary">
                    ₵ {finalPrice}
                  </span>
                )}
              </div>
              {!isEnterprise && (
                <p className="text-sm text-muted-foreground">
                  {billingPeriod === 'yearly'
                    ? `Billed annually (₵ ${yearlyPerMonth}/month)`
                    : 'Billed monthly'}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border border-gray-200">
          <CardHeader>
            <CardTitle>{isEnterprise ? 'Contact Sales' : 'Payment'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {isEnterprise ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Enterprise plans include unlimited team members and custom configuration. Contact our sales team for pricing and setup.
                </p>
                <Button
                  variant="outline"
                  className="w-full min-h-[44px]"
                  onClick={() => window.open('mailto:contact@nexpro.com?subject=Enterprise%20Plan%20Inquiry', '_blank')}
                >
                  Contact Sales
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Pay securely with Paystack using your card.
                </p>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={handlePay}
                      className="w-full min-h-[44px] h-12 text-base font-semibold"
                      disabled={payMutation.isPending}
                    >
                  {payMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Opening secure card checkout…
                    </>
                  ) : (
                    <>
                      <CreditCard className="mr-2 h-4 w-4" />
                      Pay ₵ {finalPrice} with Paystack
                    </>
                  )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Complete payment with Paystack</TooltipContent>
                </Tooltip>

                <p className="text-xs text-muted-foreground text-center">
                  By completing this purchase, you agree to our Terms of Service and Privacy Policy
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  );
};

export default Checkout;
