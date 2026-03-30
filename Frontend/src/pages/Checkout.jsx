import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  CreditCard,
  CheckCircle,
  ArrowLeft,
  Loader2,
  Zap,
  Crown,
  Building2,
  Check
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import settingsService from '../services/settingsService';
import authService from '../services/authService';
import { showSuccess, showError } from '../utils/toast';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
const planNames = {
  starter: 'Starter',
  professional: 'Professional',
  enterprise: 'Enterprise'
};

const monthlyPrice = {
  starter: 129,
  professional: 250,
  enterprise: null
};

const yearlyPrice = {
  starter: 99 * 12,
  professional: 199 * 12,
  enterprise: null
};

const PLANS = [
  { id: 'starter', name: 'Starter', icon: Zap, monthly: 129, yearlyPerMonth: 99 },
  { id: 'professional', name: 'Professional', icon: Crown, monthly: 250, yearlyPerMonth: 199, popular: true },
  { id: 'enterprise', name: 'Enterprise', icon: Building2, contactSales: true }
];

const Checkout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { activeTenant, user, refreshAuthState, needsEmailVerification } = useAuth();
  const [verifying, setVerifying] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [verified, setVerified] = useState(false);
  const verifyStartedRef = useRef(false);

  const initialData = location.state || { plan: 'starter', billingPeriod: 'monthly' };
  const [selectedPlan, setSelectedPlan] = useState(initialData.plan || 'starter');
  const [billingPeriod, setBillingPeriod] = useState(initialData.billingPeriod || 'monthly');

  const plan = selectedPlan;
  const finalPrice = billingPeriod === 'yearly' && plan !== 'enterprise'
    ? (plan === 'starter' ? 99 * 12 : 199 * 12)
    : monthlyPrice[plan];
  const isEnterprise = plan === 'enterprise';

  const reference = searchParams.get('reference');

  const verifyMutation = useMutation({
    mutationFn: (ref) => settingsService.verifySubscriptionPayment(ref),
    onSuccess: () => {
      setVerified(true);
      showSuccess('Payment successful! Your subscription is now active.');
      queryClient.invalidateQueries({ queryKey: ['settings', 'subscription'] });
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
        Choose your plan and complete your subscription upgrade
      </p>

      {/* Plan Selection */}
      <Card className="border border-gray-200 mb-8">
        <CardHeader>
          <CardTitle>Choose Your Plan</CardTitle>
          <CardDescription>Select a plan before completing your purchase</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Billing</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setBillingPeriod('monthly')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                  billingPeriod === 'monthly' ? 'bg-brand text-white' : 'bg-muted text-foreground hover:bg-muted/80'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingPeriod('yearly')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                  billingPeriod === 'yearly' ? 'bg-brand text-white' : 'bg-muted text-foreground hover:bg-muted/80'
                }`}
              >
                Yearly
              </button>
              {billingPeriod === 'yearly' && (
                <span className="text-xs text-green-600 font-medium">Save up to 23%</span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PLANS.map((p) => {
              const Icon = p.icon;
              const isSelected = plan === p.id;
              const priceDisplay = p.contactSales
                ? "Let's talk"
                : billingPeriod === 'yearly'
                  ? `₵ ${p.yearlyPerMonth}/mo`
                  : `₵ ${p.monthly}/mo`;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPlan(p.id)}
                  className={`text-left p-4 rounded-lg transition-all ${
                    isSelected ? 'border border-brand bg-brand-5' : 'border border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Icon className="h-5 w-5 text-brand" />
                      <span className="font-semibold">{p.name}</span>
                    </div>
                    {isSelected && <Check className="h-5 w-5 text-brand" />}
                  </div>
                  <div className="text-lg font-bold">{priceDisplay}</div>
                  {p.popular && (
                    <span className="inline-block mt-2 text-xs font-medium text-brand">Most Popular</span>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

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
                  <span>{plan === 'starter' ? '₵ 99/mo' : '₵ 199/mo'}</span>
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
                    ? `Billed annually (₵ ${plan === 'starter' ? 99 : 199}/month)`
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
