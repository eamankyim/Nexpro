import { useCallback, useEffect, useMemo, useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Loader2, LockKeyhole, MailCheck, ShieldCheck, ShoppingBag, X } from 'lucide-react';

import { dashboardLink } from '../../config';
import { useStorefrontAuth } from '../../context/StorefrontAuthContext';
import { showError, showSuccess } from '../../utils/toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const getErrorMessage = (error) => (
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  error?.message ||
  'Authentication failed. Please try again.'
);

const initialForm = {
  name: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
  otp: '',
};

const ShopperAuthModal = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    authModal,
    closeShopperAuthModal,
    googleAuth,
    googleClientId,
    googleConfigLoaded,
    login,
    register,
    resendVerification,
    verifyEmail,
  } = useStorefrontAuth();
  const [mode, setMode] = useState('signup');
  const [form, setForm] = useState(initialForm);
  const [signupStep, setSignupStep] = useState('details');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const isOpen = Boolean(authModal?.isOpen);
  const isSignup = mode === 'signup';
  const isVerification = mode === 'verify';
  const isSignupDetailsStep = isSignup && signupStep === 'details';
  const isSignupSecurityStep = isSignup && signupStep === 'security';
  const returnTo = useMemo(() => {
    const requested = authModal?.intent?.returnTo || `${location.pathname}${location.search || ''}` || '/';
    return requested.startsWith('/') && !requested.startsWith('//') ? requested : '/';
  }, [authModal?.intent?.returnTo, location.pathname, location.search]);
  const isCheckoutReturn = returnTo.startsWith('/checkout');
  const targetLabel = isCheckoutReturn ? 'checkout' : returnTo.startsWith('/account') ? 'your account' : 'home';

  useEffect(() => {
    if (!isOpen) return;
    setMode(authModal?.mode === 'login' ? 'login' : 'signup');
    setSignupStep('details');
    setForm((current) => ({
      ...initialForm,
      email: current.email,
    }));
  }, [authModal?.mode, isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') closeShopperAuthModal();
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeShopperAuthModal, isOpen]);

  const updateField = useCallback((field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  }, []);

  const completeAuthentication = useCallback((message) => {
    showSuccess(message);
    closeShopperAuthModal();
    navigate(returnTo, { replace: false });
  }, [closeShopperAuthModal, navigate, returnTo]);

  const handleSubmit = useCallback(async (event) => {
    event.preventDefault();

    if (isSignupDetailsStep) {
      setSignupStep('security');
      return;
    }

    if (isSignupSecurityStep && form.password !== form.confirmPassword) {
      showError('Passwords do not match. Please confirm your password.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isVerification) {
        await verifyEmail({ email: form.email, otp: form.otp });
        completeAuthentication(`Email verified. You can continue to ${targetLabel}.`);
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
          completeAuthentication(data?.customer?.isEmailVerified
            ? `Account created. You can continue to ${targetLabel}.`
            : 'Account created. Check your email to verify from your account.');
          return;
        }

        if (data?.verificationRequired) {
          showSuccess('Verification code sent. Check your email.');
          setMode('verify');
          return;
        }

        completeAuthentication(`Account created. You can continue to ${targetLabel}.`);
        return;
      }

      await login({ email: form.email, password: form.password });
      completeAuthentication(`Signed in. You can continue to ${targetLabel}.`);
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
  }, [
    completeAuthentication,
    form.confirmPassword,
    form.email,
    form.name,
    form.otp,
    form.password,
    form.phone,
    isSignup,
    isSignupDetailsStep,
    isSignupSecurityStep,
    isVerification,
    login,
    register,
    targetLabel,
    updateField,
    verifyEmail,
  ]);

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

  const handleGoogleSuccess = useCallback(async (credentialResponse) => {
    const idToken = credentialResponse?.credential;
    if (!idToken) {
      showError('Google did not return a sign-in token. Please try again.');
      return;
    }

    setIsGoogleSubmitting(true);
    try {
      await googleAuth(idToken, { signUp: isSignup });
      completeAuthentication(isSignup ? `Google account connected. You can continue to ${targetLabel}.` : `Signed in with Google. You can continue to ${targetLabel}.`);
    } catch (error) {
      const errorData = error?.response?.data;
      if (!isSignup && errorData?.code === 'GOOGLE_SHOPPER_NOT_FOUND') {
        setMode('signup');
        showError('No shopper account was found for that Google account. Choose Sign up with Google to create one.');
      } else {
        showError(getErrorMessage(error));
      }
    } finally {
      setIsGoogleSubmitting(false);
    }
  }, [completeAuthentication, googleAuth, isSignup, targetLabel]);

  const handleGoogleError = useCallback(() => {
    setIsGoogleSubmitting(false);
    showError('Google sign-in was cancelled or failed.');
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-slate-950/60 p-0 sm:items-center sm:px-6 sm:py-4" role="dialog" aria-modal="true" aria-labelledby="shopper-auth-title">
      <div className="relative grid h-dvh max-h-none w-full max-w-none overflow-x-hidden overflow-y-auto border-0 bg-white sm:h-auto sm:max-h-[92vh] sm:max-w-5xl sm:rounded-[2rem] sm:border sm:border-green-200 md:grid-cols-[0.9fr_1.1fr]">
        <button
          type="button"
          onClick={closeShopperAuthModal}
          className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          aria-label="Close shopper account modal"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="min-w-0 bg-green-50 p-4 pt-14 sm:p-5 sm:pt-14 md:p-8">
          <div className="flex items-center gap-2 text-sm font-semibold text-green-800">
            <Link to="/" onClick={closeShopperAuthModal} className="hover:text-green-950">Home</Link>
            <span>/</span>
            <span>Create shopper account</span>
          </div>

          <span className="mt-8 flex h-14 w-14 items-center justify-center rounded-2xl border border-green-200 bg-white text-green-800">
            <LockKeyhole className="h-7 w-7" />
          </span>
          <p className="mt-6 text-sm font-bold uppercase tracking-[0.18em] text-green-700">No Guest Checkout</p>
          <h1 id="shopper-auth-title" className="mt-3 text-2xl font-black text-green-950 sm:text-3xl md:text-4xl">
            Create an account to buy
          </h1>
          <p className="mt-4 text-sm leading-6 text-green-950/70">
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

        <form onSubmit={handleSubmit} className="min-w-0 space-y-4 p-4 pt-16 sm:p-5 sm:pt-16 md:p-8 md:pt-8">
          <div className="grid grid-cols-2 rounded-full border border-green-100 bg-green-50 p-1 text-sm font-bold">
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setSignupStep('details');
              }}
              className={`rounded-full px-3 py-2 transition-colors ${isSignup || isVerification ? 'bg-white text-green-900' : 'text-green-800 hover:text-green-950'}`}
            >
              New customer
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setSignupStep('details');
              }}
              className={`rounded-full px-3 py-2 transition-colors ${!isSignup && !isVerification ? 'bg-white text-green-900' : 'text-green-800 hover:text-green-950'}`}
            >
              I already have an account
            </button>
          </div>

          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-green-700">
              {isVerification ? 'Email activation' : isSignup ? 'New customer' : 'Existing customer'}
            </p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">
              {isVerification ? 'Enter the 6-digit code' : isSignupSecurityStep ? 'Secure your shopper account' : isSignup ? 'Create your shopper account' : 'Sign in to your shopper account'}
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

          {isSignup ? (
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              <span className={isSignupDetailsStep ? 'text-green-800' : 'text-slate-400'}>1. Customer details</span>
              <span className="h-px flex-1 bg-slate-200" />
              <span className={isSignupSecurityStep ? 'text-green-800' : 'text-slate-400'}>2. Password</span>
            </div>
          ) : null}

          {isSignupDetailsStep ? (
            <div className="grid gap-2">
              <label className="text-sm font-semibold text-slate-700" htmlFor="shopper-auth-name">Full name</label>
              <Input
                id="shopper-auth-name"
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
                autoComplete="name"
                required
              />
            </div>
          ) : null}

          {!isSignupSecurityStep ? (
            <div className="grid gap-2">
              <label className="text-sm font-semibold text-slate-700" htmlFor="shopper-auth-email">Email</label>
              <Input
                id="shopper-auth-email"
                type="email"
                value={form.email}
                onChange={(event) => updateField('email', event.target.value)}
                autoComplete="email"
                disabled={isVerification}
                required
              />
            </div>
          ) : null}

          {isSignupDetailsStep ? (
            <div className="grid gap-2">
              <label className="text-sm font-semibold text-slate-700" htmlFor="shopper-auth-phone">Phone</label>
              <Input
                id="shopper-auth-phone"
                value={form.phone}
                onChange={(event) => updateField('phone', event.target.value)}
                autoComplete="tel"
                required
              />
            </div>
          ) : null}

          {isSignupSecurityStep ? (
            <Alert className="border-green-200 bg-green-50">
              <ShieldCheck className="h-4 w-4" />
              <AlertDescription>
                Passwords must be at least 8 characters. You can go back to edit {form.email || 'your customer details'} before checkout.
              </AlertDescription>
            </Alert>
          ) : null}

          {isVerification ? (
            <div className="grid gap-2">
              <label className="text-sm font-semibold text-slate-700" htmlFor="shopper-auth-otp">
                Verification code
              </label>
              <Input
                id="shopper-auth-otp"
                inputMode="numeric"
                maxLength={6}
                pattern="[0-9]{6}"
                value={form.otp}
                onChange={(event) => updateField('otp', event.target.value.replace(/\D/g, '').slice(0, 6))}
                autoComplete="one-time-code"
                required
              />
            </div>
          ) : !isSignupDetailsStep ? (
            <div className="grid gap-2">
              <label className="text-sm font-semibold text-slate-700" htmlFor="shopper-auth-password">Password</label>
              <Input
                id="shopper-auth-password"
                type="password"
                value={form.password}
                onChange={(event) => updateField('password', event.target.value)}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                minLength={8}
                required
              />
            </div>
          ) : null}

          {isSignupSecurityStep ? (
            <div className="grid gap-2">
              <label className="text-sm font-semibold text-slate-700" htmlFor="shopper-auth-confirm-password">Confirm password</label>
              <Input
                id="shopper-auth-confirm-password"
                type="password"
                value={form.confirmPassword}
                onChange={(event) => updateField('confirmPassword', event.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
          ) : null}

          {!isSignup && !isVerification ? (
            <div className="flex flex-wrap items-center justify-end gap-3 text-sm">
              <Link
                className="font-semibold text-green-800 hover:underline"
                to={`/forgot-password?returnTo=${encodeURIComponent(returnTo)}`}
                onClick={closeShopperAuthModal}
              >
                Forgot password?
              </Link>
            </div>
          ) : null}

          {!isVerification && !isSignupSecurityStep ? (
            <div className="rounded-2xl bg-white p-3">
              {googleClientId ? (
                <div className="flex min-h-[44px] w-full min-w-0 justify-center overflow-hidden" data-google-configured="true">
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={handleGoogleError}
                    text={isSignup ? 'signup_with' : 'signin_with'}
                    shape="pill"
                    size="large"
                    width="300"
                    theme="outline"
                  />
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full rounded-full border-slate-200 text-slate-700 hover:bg-slate-50"
                  disabled={!googleConfigLoaded}
                  onClick={() => showError('Google sign-in is not configured yet. Use email and password for now.')}
                >
                  {googleConfigLoaded ? 'Google sign-in unavailable' : 'Loading Google sign-in...'}
                </Button>
              )}
              {isGoogleSubmitting ? (
                <p className="mt-2 flex items-center justify-center text-xs font-semibold text-green-800">
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Connecting your Google account...
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-full border-green-200 text-green-800 hover:bg-green-50 sm:w-auto sm:shrink-0"
              onClick={() => {
                if (isSignupSecurityStep) {
                  setSignupStep('details');
                  return;
                }
                setSignupStep('details');
                setMode(isVerification || isSignup ? 'login' : 'signup');
              }}
            >
              {isVerification ? 'Back to sign in' : isSignupSecurityStep ? 'Back to edit details' : isSignup ? 'I already have an account' : 'New customer'}
            </Button>
            <Button type="submit" className="w-full rounded-full bg-green-700 hover:bg-green-800 sm:flex-1" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isVerification ? 'Verify and continue' : isSignupDetailsStep ? 'Continue' : isSignup ? 'Create account and continue' : 'Sign in'}
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
            <button type="button" className="font-semibold text-green-800 hover:text-green-950" onClick={closeShopperAuthModal}>
              Continue browsing without signing in
            </button>
          </p>
        </form>
      </div>
    </div>
  );
};

export default ShopperAuthModal;
