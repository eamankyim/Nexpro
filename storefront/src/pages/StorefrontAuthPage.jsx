import { useCallback, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, LockKeyhole, MailCheck, ShieldCheck, ShoppingBag } from 'lucide-react';

import { useStorefrontAuth } from '../context/StorefrontAuthContext';
import { dashboardLink } from '../config';
import { showError, showSuccess } from '../utils/toast';
import { Breadcrumbs, PageShell } from '../components/storefront/StorefrontLayout';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const getErrorMessage = (error) => (
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  error?.message ||
  'Authentication failed. Please try again.'
);

const HOME_PATH = '/';

const isSafeReturnPath = (path) => (
  typeof path === 'string' && path.startsWith('/') && !path.startsWith('//')
);

const StorefrontAuthPage = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { login, register, resendVerification, sendLoginOtp, verifyEmail, verifyLoginOtp } = useStorefrontAuth();
  const [mode, setMode] = useState(
    searchParams.get('mode') === 'verify' || location.pathname === '/verify-email'
      ? 'verify'
      : searchParams.get('mode') === 'signup' || location.pathname === '/signup' ? 'signup' : 'login'
  );
  const [form, setForm] = useState({ name: '', email: searchParams.get('email') || '', phone: '', password: '', otp: '' });
  const [loginMethod, setLoginMethod] = useState('password');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isSendingLoginOtp, setIsSendingLoginOtp] = useState(false);
  const returnTo = useMemo(() => {
    const requested = searchParams.get('returnTo') || location.state?.returnTo || '';
    return isSafeReturnPath(requested) ? requested : HOME_PATH;
  }, [location.state?.returnTo, searchParams]);
  const isCheckoutReturn = returnTo.startsWith('/checkout');
  const targetLabel = isCheckoutReturn ? 'checkout' : returnTo.startsWith('/account') ? 'your account' : 'home';
  const isSignup = mode === 'signup';
  const isVerification = mode === 'verify';
  const isOtpLogin = !isSignup && !isVerification && loginMethod === 'otp';

  const updateField = useCallback((field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  }, []);

  const handleSubmit = useCallback(async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      if (isVerification) {
        await verifyEmail({ email: form.email, otp: form.otp });
        showSuccess(`Email verified. You can continue to ${targetLabel}.`);
        navigate(returnTo, { replace: true });
        return;
      }

      if (isSignup) {
        const data = await register({
          name: form.name,
          email: form.email,
          phone: form.phone,
          password: form.password,
        });
        if (data?.token || data?.customer) {
          showSuccess(data?.customer?.isEmailVerified ? `Account created. You can continue to ${targetLabel}.` : 'Account created. Check your email to verify from your account.');
        } else if (data?.verificationRequired) {
          showSuccess('Verification code sent. Check your email.');
          setMode('verify');
          return;
        } else {
          showSuccess(`Account created. You can continue to ${targetLabel}.`);
        }
      } else if (isOtpLogin) {
        await verifyLoginOtp({ email: form.email, otp: form.otp });
        showSuccess(`Signed in. You can continue to ${targetLabel}.`);
      } else {
        await login({ email: form.email, password: form.password });
        showSuccess(`Signed in. You can continue to ${targetLabel}.`);
      }
      navigate(returnTo, { replace: true });
    } catch (error) {
      const errorData = error?.response?.data;
      if (errorData?.errorCode === 'EMAIL_VERIFICATION_REQUIRED') {
        const pendingEmail = errorData?.data?.email || form.email;
        updateField('email', pendingEmail);
        setMode('verify');
      }
      showError(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }, [form.email, form.name, form.otp, form.password, form.phone, isOtpLogin, isSignup, isVerification, login, navigate, register, returnTo, targetLabel, verifyEmail, verifyLoginOtp]);

  const handleResend = useCallback(async () => {
    setIsResending(true);
    try {
      await resendVerification({ email: form.email });
      showSuccess('A new verification code has been sent.');
    } catch (error) {
      showError(getErrorMessage(error));
    } finally {
      setIsResending(false);
    }
  }, [form.email, resendVerification]);

  const handleSendLoginOtp = useCallback(async () => {
    setIsSendingLoginOtp(true);
    try {
      const response = await sendLoginOtp({ email: form.email });
      showSuccess(response?.message || 'Sign-in code sent. Check your email.');
    } catch (error) {
      showError(getErrorMessage(error));
    } finally {
      setIsSendingLoginOtp(false);
    }
  }, [form.email, sendLoginOtp]);

  return (
    <PageShell activePath="/login">
      <Breadcrumbs items={[{ label: isVerification ? 'Verify email' : isSignup ? 'Create shopper account' : 'Shopper login' }]} />

      <section className="mx-auto grid max-w-5xl gap-6 rounded-2xl border border-green-200 bg-white p-5 sm:rounded-[2rem] md:grid-cols-[0.9fr_1.1fr] md:p-8">
        <div className="rounded-2xl border border-green-100 bg-green-50 p-6 sm:rounded-[1.5rem]">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-green-200 bg-white text-green-800">
            <LockKeyhole className="h-7 w-7" />
          </span>
          <p className="mt-6 text-sm font-bold uppercase tracking-[0.18em] text-green-700">No Guest Checkout</p>
          <h1 className="mt-3 text-3xl font-black text-green-950">
            {isVerification ? 'Verify your shopper email' : isSignup ? 'Create your shopper account' : isCheckoutReturn ? 'Sign in to continue checkout' : 'Sign in to shop Sabito Store'}
          </h1>
          <p className="mt-3 text-sm leading-6 text-green-950/70">
            Shoppers can browse freely, but purchases require a Sabito Store customer account for order tracking, trade assurance, and seller communication.
          </p>
          {isCheckoutReturn ? (
            <Alert className="mt-6 border-amber-200 bg-amber-50">
              <ShoppingBag className="h-4 w-4" />
              <AlertDescription>
                Your cart and checkout path are preserved. After authentication, you will return to the purchase flow.
              </AlertDescription>
            </Alert>
          ) : null}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-green-700">
              {isVerification ? 'Email activation' : isSignup ? 'New customer' : isOtpLogin ? 'Email code login' : 'Returning customer'}
            </p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">
              {isVerification ? 'Enter the 6-digit code' : isSignup ? 'Create your shopper account' : isOtpLogin ? 'Login with a one-time code' : 'Login to your shopper account'}
            </h2>
          </div>

          {isVerification ? (
            <Alert className="border-green-200 bg-green-50">
              <MailCheck className="h-4 w-4" />
              <AlertDescription>
                We sent a verification code to {form.email || 'your email'}. You can verify here or from inside your shopper account.
              </AlertDescription>
            </Alert>
          ) : null}

          {isOtpLogin ? (
            <Alert className="border-green-200 bg-green-50">
              <ShieldCheck className="h-4 w-4" />
              <AlertDescription>
                Enter your email, request a code, then use the 6-digit code to sign in without your password.
              </AlertDescription>
            </Alert>
          ) : null}

          {isSignup ? (
            <div className="grid gap-2">
              <label className="text-sm font-semibold text-slate-700" htmlFor="name">Full name</label>
              <Input
                id="name"
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
                autoComplete="name"
                required
              />
            </div>
          ) : null}

          <div className="grid gap-2">
            <label className="text-sm font-semibold text-slate-700" htmlFor="email">Email</label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(event) => updateField('email', event.target.value)}
              autoComplete="email"
              disabled={isVerification}
              required
            />
          </div>

          {isSignup ? (
            <div className="grid gap-2">
              <label className="text-sm font-semibold text-slate-700" htmlFor="phone">Phone</label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(event) => updateField('phone', event.target.value)}
                autoComplete="tel"
                required
              />
            </div>
          ) : null}

          {isVerification || isOtpLogin ? (
            <div className="grid gap-2">
              <label className="text-sm font-semibold text-slate-700" htmlFor="otp">
                {isOtpLogin ? 'Sign-in code' : 'Verification code'}
              </label>
              <Input
                id="otp"
                inputMode="numeric"
                maxLength={6}
                pattern="[0-9]{6}"
                value={form.otp}
                onChange={(event) => updateField('otp', event.target.value.replace(/\D/g, '').slice(0, 6))}
                autoComplete="one-time-code"
                required
              />
            </div>
          ) : (
          <div className="grid gap-2">
            <label className="text-sm font-semibold text-slate-700" htmlFor="password">Password</label>
            <Input
              id="password"
              type="password"
              value={form.password}
              onChange={(event) => updateField('password', event.target.value)}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              minLength={8}
              required
            />
          </div>
          )}

          {!isSignup && !isVerification ? (
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <button
                type="button"
                className="font-semibold text-green-800 hover:underline"
                onClick={() => {
                  setLoginMethod(isOtpLogin ? 'password' : 'otp');
                  updateField('otp', '');
                }}
              >
                {isOtpLogin ? 'Use password instead' : 'Email me a sign-in code'}
              </button>
              {isOtpLogin ? (
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full border-green-200 text-green-800 hover:bg-green-50"
                  disabled={isSendingLoginOtp || !form.email}
                  onClick={handleSendLoginOtp}
                >
                  {isSendingLoginOtp ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Send code
                </Button>
              ) : (
                <Link className="font-semibold text-green-800 hover:underline" to={`/forgot-password?returnTo=${encodeURIComponent(returnTo)}`}>
                  Forgot password?
                </Link>
              )}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="rounded-full border-green-200 text-green-800 hover:bg-green-50"
              onClick={() => setMode(isVerification || isSignup ? 'login' : 'signup')}
            >
              {isVerification ? 'Back to login' : isSignup ? 'I already have an account' : 'Create account'}
            </Button>
            <Button type="submit" className="rounded-full bg-green-700 hover:bg-green-800" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isVerification ? 'Verify and continue' : isSignup ? 'Create account and continue' : isOtpLogin ? 'Verify code and continue' : 'Sign in'}
            </Button>
          </div>

          {isVerification ? (
            <div className="text-center">
              <Button
                type="button"
                variant="ghost"
                className="rounded-full text-green-800 hover:bg-green-50"
                disabled={isResending || !form.email}
                onClick={handleResend}
              >
                {isResending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Resend verification code
              </Button>
            </div>
          ) : null}

          <p className="text-center text-xs text-slate-500">
            Looking for seller access? <a className="font-semibold text-green-800" href={dashboardLink('/login')}>Use the Sabito business dashboard</a>.
          </p>
          <p className="text-center text-xs text-slate-500">
            <Link className="font-semibold text-green-800" to="/products">Continue browsing without signing in</Link>
          </p>
        </form>
      </section>
    </PageShell>
  );
};

export default StorefrontAuthPage;
