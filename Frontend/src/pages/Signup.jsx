import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { GoogleLogin } from '@react-oauth/google';
import { User, Mail, Loader2, Eye, EyeOff, RefreshCw, HelpCircle } from 'lucide-react';
import authService from '../services/authService';
import inviteService from '../services/inviteService';
import { useAuth } from '../context/AuthContext';
import { usePublicConfig } from '../context/PublicConfigContext';
import { useResponsive } from '../hooks/useResponsive';
import { showSuccess, showError } from '../utils/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertCircle } from 'lucide-react';
import { calculatePasswordStrength } from '../utils/passwordStrength';
import africanWomanImage from '../assets/African focused woman.png';
import confetti from 'canvas-confetti';

/** Minimum time (ms) the loading animation runs before transitioning to success. Both lines: 0–2.6s first, 2.6–5.2s second. */
const MIN_LOADING_DISPLAY_MS = 5200;

const signupSchema = z.object({
  name: z.string().min(2, 'Enter your full name'),
  email: z.string().email('Enter a valid email'),
});

const passwordSchema = z.object({
  password: z.string().min(6, 'Use at least 6 characters'),
  confirmPassword: z.string().min(6, 'Confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

/** Invite step 2: Full name + Password + Confirm password */
const inviteStep2Schema = z.object({
  name: z.string().min(2, 'Enter your full name'),
  password: z.string().min(6, 'Use at least 6 characters'),
  confirmPassword: z.string().min(6, 'Confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const Signup = () => {
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [inviteData, setInviteData] = useState(null);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({ strength: 'weak', feedback: '' });
  const [currentStep, setCurrentStep] = useState(1); // 1 = name/email, 2 = password
  const [signupData, setSignupData] = useState({ name: '', email: '' });
  const [searchParams, setSearchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { tenantSignup, register: registerWithAuth, googleAuth, logout, isAuthenticated, user, activeTenant, wasInvited } = useAuth();
  const { googleClientId } = usePublicConfig();
  const [registeredAsPlatformAdmin, setRegisteredAsPlatformAdmin] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showWelcomeScreen, setShowWelcomeScreen] = useState(false);
  const [welcomeStatus, setWelcomeStatus] = useState('loading'); // 'loading' | 'success' | 'error'
  const [overlayPhase, setOverlayPhase] = useState('loading'); // 'loading' | 'success' | 'error'
  const [welcomeErrorMessage, setWelcomeErrorMessage] = useState('');
  const overlayStartTimeRef = useRef(null);
  const { isMobile } = useResponsive();
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [registeredAsInvitedMember, setRegisteredAsInvitedMember] = useState(false);
  const inviteType = String(inviteData?.inviteType || '').trim().toLowerCase();
  const isPlatformAdminInvite = inviteType === 'platform_admin';
  const isNewTenantInvite =
    inviteType === 'new_tenant' || (!inviteType && !inviteData?.tenantId);

  // We no longer choose business type here – signup is generic, onboarding sets shop/studio/pharmacy.

  // Sync overlay phase with welcome status; enforce minimum display time for full two-line animation
  useEffect(() => {
    if (welcomeStatus === 'loading') {
      setOverlayPhase('loading');
    } else if (welcomeStatus === 'success') {
      const elapsed = overlayStartTimeRef.current ? Date.now() - overlayStartTimeRef.current : 0;
      const delay = Math.max(0, MIN_LOADING_DISPLAY_MS - elapsed);
      const t1 = setTimeout(() => setOverlayPhase('success'), delay);
      return () => clearTimeout(t1);
    } else if (welcomeStatus === 'error') {
      setOverlayPhase('error');
    }
  }, [welcomeStatus]);

  // Redirect authenticated users only if they're not in the signup process.
  // When showWelcomeScreen is true (post-signup overlay), do NOT auto-redirect so the user must click the CTA.
  // When ?token= is present (team/workspace invite), NEVER auto-redirect: user must complete invite signup
  // (or sign out first if another account is logged in).
  useEffect(() => {
    if (token) return;
    if (isAuthenticated && !isSubmitting && !showWelcomeScreen) {
      const onboardingCompleted = activeTenant?.metadata?.onboarding?.completedAt;
      if (onboardingCompleted || wasInvited) {
        navigate('/dashboard', { replace: true });
      } else {
        navigate('/onboarding', { replace: true });
      }
    }
  }, [token, isAuthenticated, activeTenant, navigate, isSubmitting, showWelcomeScreen, wasInvited]);

  const form = useForm({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: '',
      email: '',
    },
  });

  const passwordForm = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  const inviteStep2Form = useForm({
    resolver: zodResolver(inviteStep2Schema),
    defaultValues: {
      name: '',
      password: '',
      confirmPassword: '',
    },
  });

  const passwordValue = passwordForm.watch('password');
  const invitePasswordValue = inviteStep2Form.watch('password');
  const activePassword = token && inviteData ? invitePasswordValue : passwordValue;

  useEffect(() => {
    // Only validate invite token if token is provided
    if (token) {
      validateInviteToken();
    } else {
      setValidating(false);
    }
  }, [token]);

  useEffect(() => {
    if (activePassword) {
      const strength = calculatePasswordStrength(activePassword);
      setPasswordStrength(strength);
    } else {
      setPasswordStrength({ strength: 'weak', feedback: '' });
    }
  }, [activePassword]);

  // Pre-fill invite name when backend provided it (omit inviteStep2Form from deps — unstable ref can cause setValue loops / flicker)
  useEffect(() => {
    if (token && inviteData?.name) {
      inviteStep2Form.setValue('name', inviteData.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- inviteStep2Form identity may change; setValue is stable
  }, [token, inviteData?.name]);

  // Confetti only while loading (Option 1: no confetti on success or error)
  useEffect(() => {
    if (!showWelcomeScreen || welcomeStatus !== 'loading') return;
    const burst = () => {
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
    };
    burst();
    const t = setTimeout(burst, 1000);
    return () => clearTimeout(t);
  }, [showWelcomeScreen, welcomeStatus]);

  const validateInviteToken = async () => {
    if (!token) {
      setValidating(false);
      return;
    }

    setValidating(true);
    try {
      const response = await inviteService.validateInvite(token);
      const body = response?.data ?? response;
      const invitePayload = body?.data ?? body;
      setInviteData(invitePayload);
      setValidating(false);
    } catch (error) {
      console.log('Validate error:', error.response);
      setError(error.response?.data?.message || 'Invalid or expired invite token');
      setValidating(false);
    }
  };

  const onSubmit = async (values) => {
    // Step 1: Validate email availability before moving to password step
    const trimmedName = values.name?.trim() || '';
    const trimmedEmail = values.email?.trim().toLowerCase() || '';

    // Ensure form state uses trimmed values
    form.setValue('name', trimmedName);
    form.setValue('email', trimmedEmail);

    try {
      setCheckingEmail(true);
      const result = await authService.checkEmailAvailability(trimmedEmail);
      const exists =
        result?.data?.exists ??
        result?.exists ??
        false;

      console.log('[Signup] Email availability check', {
        email: trimmedEmail,
        exists,
      });

      if (exists) {
        form.setError('email', {
          type: 'manual',
          message: 'An account with this email already exists. Please sign in instead.',
        });
        return;
      }
    } catch (err) {
      console.error('[Signup] Failed to check email availability', err);
      const status = err?.response?.status;
      const message = status === 404
        ? 'Email check is unavailable. Restart the backend server and try again, or sign in if you already have an account.'
        : err?.response?.data?.message || err?.message || 'Could not verify email. Please try again.';
      form.setError('email', {
        type: 'manual',
        message,
      });
      return;
    } finally {
      setCheckingEmail(false);
    }

    setSignupData({ name: trimmedName, email: trimmedEmail });
    setCurrentStep(2);
  };

  const onInviteStep2Submit = async (values) => {
    overlayStartTimeRef.current = Date.now();
    setShowWelcomeScreen(true);
    setWelcomeStatus('loading');
    setWelcomeErrorMessage('');
    setLoading(true);
    setIsSubmitting(true);
    try {
      const registerData = {
        name: values.name,
        email: inviteData.email,
        password: values.password,
        inviteToken: token,
      };
      const apiStart = Date.now();
      const response = await registerWithAuth(registerData);
      const apiMs = Date.now() - apiStart;
      console.log('[Signup] Invite register API responded in', apiMs, 'ms');
      const data = response?.data ?? response;
      setRegisteredAsPlatformAdmin(Boolean(data?.isPlatformAdmin));
      setRegisteredAsInvitedMember(Boolean(!isNewTenantInvite && !isPlatformAdminInvite));
      setWelcomeStatus('success');
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Something went wrong. Please try again.';
      setWelcomeStatus('error');
      setWelcomeErrorMessage(msg);
    } finally {
      setLoading(false);
      setIsSubmitting(false);
    }
  };

  const onPasswordSubmit = async (values) => {
    overlayStartTimeRef.current = Date.now();
    setShowWelcomeScreen(true);
    setWelcomeStatus('loading');
    setWelcomeErrorMessage('');
    setLoading(true);
    setIsSubmitting(true);
    try {
      const payload = {
        companyName: 'My Business', // Placeholder; user sets real business name in onboarding
        companyEmail: signupData.email,
        adminName: signupData.name,
        adminEmail: signupData.email,
        password: values.password,
        plan: 'trial',
      };
      const apiStart = Date.now();
      await tenantSignup(payload);
      const apiMs = Date.now() - apiStart;
      console.log('[Signup] tenantSignup API responded in', apiMs, 'ms');
      setWelcomeStatus('success');
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Something went wrong. Please try again.';
      setWelcomeStatus('error');
      setWelcomeErrorMessage(msg);
    } finally {
      setLoading(false);
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignupSuccess = useCallback(
    async (credentialResponse) => {
      const idToken = credentialResponse?.credential;
      if (!idToken) return;
      overlayStartTimeRef.current = Date.now();
      setShowWelcomeScreen(true);
      setWelcomeStatus('loading');
      setWelcomeErrorMessage('');
      setLoading(true);
      setIsSubmitting(true);
      try {
        await googleAuth(idToken, {
          signUp: true,
          companyName: 'My Business',
        });
        setRegisteredAsPlatformAdmin(false);
        setWelcomeStatus('success');
      } catch (err) {
        const msg = err?.response?.data?.message || err?.message || 'Google sign-up failed. Please try again.';
        setWelcomeStatus('error');
        setWelcomeErrorMessage(msg);
      } finally {
        setLoading(false);
        setIsSubmitting(false);
      }
    },
    [googleAuth]
  );

  const handleGoogleSignupError = useCallback(() => {
    setWelcomeStatus('error');
    setWelcomeErrorMessage('Google sign-up was cancelled or failed.');
  }, []);

  if (validating) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-muted/50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-muted/50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invalid Invite</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button 
              className="w-full" 
              onClick={() => navigate('/login')}
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-background flex items-center justify-center ${isMobile ? 'p-0' : 'p-8'}`}>
      {/* Full-screen welcome overlay (loading / success / error) */}
      {showWelcomeScreen && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center text-white p-4 sm:p-6 min-h-screen overflow-auto" style={{ backgroundColor: '#0E1801' }}>
          {overlayPhase === 'loading' && (
            <div className="w-full max-w-lg flex flex-col items-center justify-center text-center space-y-4 px-2">
              <style>{`
                @keyframes signupWelcomeLineInOut {
                  0% { opacity: 0; transform: translateY(16px); }
                  20% { opacity: 1; transform: translateY(0); }
                  70% { opacity: 1; transform: translateY(0); }
                  100% { opacity: 0; transform: translateY(-12px); }
                }
                .signup-welcome-line-1 {
                  opacity: 0;
                  animation: signupWelcomeLineInOut 2.6s ease-in-out forwards;
                }
                .signup-welcome-line-2 {
                  opacity: 0;
                  animation: signupWelcomeLineInOut 2.6s ease-in-out 2.6s forwards;
                }
              `}</style>
              <h2 className="signup-welcome-line-1 text-2xl sm:text-3xl md:text-4xl font-semibold">Welcome to African Business Suite</h2>
              <h2 className="signup-welcome-line-2 text-xl sm:text-2xl md:text-4xl font-semibold text-white text-pretty px-1">The one platform you will ever need to transform your business.</h2>
            </div>
          )}
          {overlayPhase === 'success' && (
            <div className="text-center max-w-md space-y-6 px-4">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold">Account created.</h2>
              <p className="text-lg text-gray-300">
                {registeredAsPlatformAdmin
                  ? 'You can now access the Control Panel.'
                  : registeredAsInvitedMember
                    ? 'You can now access your team workspace.'
                    : 'Continue to setup your business.'}
              </p>
              <Button
                className="bg-brand hover:bg-brand-dark text-white px-8 py-3 text-base"
                onClick={() => navigate(
                  registeredAsPlatformAdmin
                    ? '/admin'
                    : registeredAsInvitedMember
                      ? '/dashboard'
                      : '/onboarding',
                  { replace: true }
                )}
              >
                {registeredAsPlatformAdmin
                  ? 'Go to Control Panel'
                  : registeredAsInvitedMember
                    ? 'Go to Dashboard'
                    : 'Continue to setup'}
              </Button>
            </div>
          )}
          {overlayPhase === 'error' && (
            <div className="text-center max-w-md space-y-6 px-4">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold">We couldn&apos;t create your account.</h2>
              <p className="text-lg text-gray-300">{welcomeErrorMessage}</p>
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90 px-8 py-3 text-base"
                onClick={() => {
                  const isAlreadyExists = /already exists|sign in instead/i.test(welcomeErrorMessage || '');
                  setShowWelcomeScreen(false);
                  setWelcomeStatus('loading');
                  setWelcomeErrorMessage('');
                  if (isAlreadyExists) {
                    navigate('/login', { replace: true });
                  }
                }}
              >
                {/already exists|sign in instead/i.test(welcomeErrorMessage || '') ? 'Sign in' : 'Try again'}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Main Content */}
      <div className={`w-full ${isMobile ? 'h-screen' : 'max-w-6xl bg-card rounded-2xl border border-border'} overflow-hidden flex flex-col ${isMobile ? '' : 'lg:flex-row'}`}>
          {/* Left Section - Form */}
          <div className={`flex-1 ${isMobile ? 'px-6 py-4' : 'p-12'} flex flex-col justify-center ${isMobile ? 'min-h-screen overflow-y-auto' : ''}`}>
            <div className={`${isMobile ? 'w-full' : 'max-w-md'} mx-auto w-full`}>
              {/* Logo */}
              <h1 className={`${isMobile ? 'text-2xl mb-4' : 'text-3xl mb-8'} font-bold text-brand`}>ABS</h1>
              
              {/* Heading */}
              <h2 className={`${isMobile ? 'text-2xl mb-1' : 'text-3xl mb-2'} font-bold text-foreground`}>
                {token && inviteData ? 'Join African Business Suite' : 'Sign up'}
              </h2>
              {token && inviteData && isAuthenticated && !showWelcomeScreen && (
                <Alert className="mb-6 border-border bg-muted/50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Different account signed in</AlertTitle>
                  <AlertDescription className="space-y-3">
                    <p>
                      You&apos;re signed in as <strong>{user?.email || 'another user'}</strong>. To accept this invite you must create the invited account—sign out first, then complete signup below.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full sm:w-auto border-border"
                      onClick={() => logout()}
                    >
                      Sign out and continue
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
              {!token && !inviteData && (
                <p className={`${isMobile ? 'text-sm mb-6' : 'mb-8'} text-gray-600`}>One place for your business.</p>
              )}
              {token && inviteData && (
                <p className={`${isMobile ? 'text-sm mb-6' : 'mb-8'} text-gray-600`}>
                  {isAuthenticated && !showWelcomeScreen
                    ? 'Sign out above to continue—then set your name and password to join with this invite.'
                    : isPlatformAdminInvite
                      ? 'You have been invited to join as a platform administrator. Set your name and password below.'
                      : isNewTenantInvite
                        ? "You've been invited to create your workspace. Set your name and password below."
                        : `You have been invited to join ${inviteData.tenant?.name || 'this business'} as ${inviteData.role ? String(inviteData.role).charAt(0).toUpperCase() + String(inviteData.role).slice(1) : 'a member'}.`
                  }
                </p>
              )}

              {/* Invite: go straight to account form (email/tenant/role shown in heading copy above) */}
              {token && inviteData ? (
                !isAuthenticated ? (
                <Form {...inviteStep2Form}>
                  <form onSubmit={inviteStep2Form.handleSubmit(onInviteStep2Submit)} className={isMobile ? "space-y-4" : "space-y-6"}>
                    {inviteData?.email && (
                      <div className="space-y-2">
                        <label className={`text-sm font-medium leading-none text-gray-700 peer-disabled:cursor-not-allowed peer-disabled:opacity-70`}>
                          Email
                        </label>
                        <div className="relative">
                          <Mail className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4'} text-gray-400`} />
                          <Input
                            type="email"
                            value={inviteData.email}
                            readOnly
                            disabled
                            className={`pl-10 ${isMobile ? 'h-[44px]' : 'h-12'} border-border ${isMobile ? 'rounded-md' : 'rounded-lg'} bg-muted border text-foreground cursor-not-allowed`}
                          />
                        </div>
                      </div>
                    )}
                    <FormField
                      control={inviteStep2Form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center gap-1.5">
                            <FormLabel className={`${isMobile ? 'text-sm' : ''} text-gray-700`}>Full Name</FormLabel>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex cursor-help text-gray-400 hover:text-gray-600" role="img" aria-label="Help">
                                    <HelpCircle className={isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-xs">
                                  Enter your full name (personal name, not the business name). This is how you&apos;ll appear in the workspace.
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          <FormControl>
                            <div className="relative">
                              <User className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4'} text-gray-400`} />
                              <Input
                                {...field}
                                className={`pl-10 ${isMobile ? 'h-[44px]' : 'h-12'} border-gray-300 ${isMobile ? 'rounded-md' : 'rounded-lg'} bg-card border border-border text-foreground placeholder:text-muted-foreground focus:border-brand focus:border focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-brand focus-visible:border`}
                                placeholder="e.g. John Doe"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={inviteStep2Form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className={`${isMobile ? 'text-sm' : ''} text-gray-700`}>Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                {...field}
                                type={showPassword ? 'text' : 'password'}
                                className={`${isMobile ? 'h-[44px]' : 'h-12'} border-gray-300 ${isMobile ? 'rounded-md' : 'rounded-lg'} pr-10 bg-card border border-border text-foreground placeholder:text-muted-foreground focus:border-brand focus:border focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-brand focus-visible:border`}
                                placeholder="Password"
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className={`absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 ${isMobile ? 'min-h-[44px] min-w-[44px] flex items-center justify-center' : ''}`}
                              >
                                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                              </button>
                            </div>
                          </FormControl>
                          {activePassword && passwordStrength.feedback && (
                            <div className={`flex items-center gap-2 ${isMobile ? 'mt-1' : 'mt-2'}`}>
                              <div className={`w-2 h-2 rounded-full ${
                                passwordStrength.strength === 'strong' ? 'bg-brand' :
                                passwordStrength.strength === 'medium' ? 'bg-[#a3e635]' : 'bg-red-500'
                              }`} />
                              <span className={`${isMobile ? 'text-xs' : 'text-sm'} ${
                                passwordStrength.strength === 'strong' ? 'text-brand' :
                                passwordStrength.strength === 'medium' ? 'text-[#a3e635]' : 'text-red-600'
                              }`}>
                                {passwordStrength.feedback}
                              </span>
                            </div>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={inviteStep2Form.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className={`${isMobile ? 'text-sm' : ''} text-gray-700`}>Confirm Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                {...field}
                                type={showPassword ? 'text' : 'password'}
                                className={`${isMobile ? 'h-[44px]' : 'h-12'} border-gray-300 ${isMobile ? 'rounded-md' : 'rounded-lg'} pr-10 bg-card border border-border text-foreground placeholder:text-muted-foreground focus:border-brand focus:border focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-brand focus-visible:border`}
                                placeholder="Confirm Password"
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className={`absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 ${isMobile ? 'min-h-[44px] min-w-[44px] flex items-center justify-center' : ''}`}
                              >
                                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                              </button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="submit"
                          className={`w-full ${isMobile ? 'h-[44px]' : 'h-12'} bg-brand hover:bg-brand-dark text-white ${isMobile ? 'rounded-md' : 'rounded-lg'} font-medium transition-all duration-200 ${isMobile ? '' : 'hover:scale-[1.02]'}`}
                          loading={loading}
                        >
                          Create Account
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Create my account</TooltipContent>
                    </Tooltip>
                  </form>
                </Form>
                ) : null
              ) : currentStep === 1 ? (
                /* Public signup step 1: Full name + Email + mode tabs */
                <>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className={isMobile ? "space-y-3" : "space-y-4"}>
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center gap-1.5">
                              <FormLabel className={`${isMobile ? 'text-sm' : ''} text-gray-700`}>Full Name</FormLabel>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex cursor-help text-gray-400 hover:text-gray-600" role="img" aria-label="Help">
                                      <HelpCircle className={isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-xs">
                                    Enter your full name (personal name, not business name). You&apos;ll set up your business details after account creation.
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <FormControl>
                              <div className="relative">
                                <User className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4'} text-gray-400`} />
                                <Input
                                  {...field}
                                  className={`pl-10 ${isMobile ? 'h-[44px]' : 'h-12'} border-gray-300 ${isMobile ? 'rounded-md' : 'rounded-lg'} bg-card border border-border text-foreground placeholder:text-muted-foreground focus:border-brand focus:border focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-brand focus-visible:border`}
                                  placeholder="e.g. John Doe"
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className={`${isMobile ? 'text-sm' : ''} text-gray-700`}>Email</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Mail className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4'} text-gray-400`} />
                                <Input
                                  {...field}
                                  className={`pl-10 ${isMobile ? 'h-[44px]' : 'h-12'} border-gray-300 ${isMobile ? 'rounded-md' : 'rounded-lg'} bg-card border border-border text-foreground placeholder:text-muted-foreground focus:border-brand focus:border focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-brand focus-visible:border`}
                                  placeholder="Please enter a valid email address"
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button
                        type="submit"
                        className={`w-full ${isMobile ? 'h-[44px]' : 'h-12'} bg-brand hover:bg-brand-dark text-white ${isMobile ? 'rounded-md' : 'rounded-lg'} font-medium transition-all duration-200 ${isMobile ? '' : 'hover:scale-[1.02]'}`}
                        disabled={loading || checkingEmail}
                      >
                        Continue
                      </Button>
                      {googleClientId && (
                        <>
                          <div className={`relative ${isMobile ? 'my-4' : 'my-6'}`}>
                            <div className="absolute inset-0 flex items-center">
                              <span className="w-full border-t border-border"></span>
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                              <span className="bg-card px-2 text-muted-foreground">Or</span>
                            </div>
                          </div>
                          <div className="flex justify-center w-full">
                            <GoogleLogin
                              onSuccess={handleGoogleSignupSuccess}
                              onError={handleGoogleSignupError}
                              useOneTap={false}
                              theme="outline"
                              size="large"
                              type="standard"
                              text="signup_with"
                              shape="rectangular"
                              // Google button has a fixed pixel width range; choose near-card width
                              width={isMobile ? '340' : '360'}
                            />
                          </div>
                        </>
                      )}
                    </form>
                  </Form>
                </>
              ) : (
                /* Public signup step 2: Password + Confirm password */
                <Form {...passwordForm}>
                  <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className={isMobile ? "space-y-4" : "space-y-6"}>
                    <div className={isMobile ? "mb-3" : "mb-4"}>
                      <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-gray-600`}>
                        Welcome, <strong>{signupData?.name?.trim() || 'there'}</strong>! Let&apos;s set up your password.
                      </p>
                    </div>
                    <FormField
                      control={passwordForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className={`${isMobile ? 'text-sm' : ''} text-gray-700`}>Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                {...field}
                                type={showPassword ? 'text' : 'password'}
                                className={`${isMobile ? 'h-[44px]' : 'h-12'} border-gray-300 ${isMobile ? 'rounded-md' : 'rounded-lg'} pr-10 bg-card border border-border text-foreground placeholder:text-muted-foreground focus:border-brand focus:border focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-brand focus-visible:border`}
                                placeholder="Password"
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className={`absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 ${isMobile ? 'min-h-[44px] min-w-[44px] flex items-center justify-center' : ''}`}
                              >
                                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                              </button>
                            </div>
                          </FormControl>
                          {activePassword && passwordStrength.feedback && (
                            <div className={`flex items-center gap-2 ${isMobile ? 'mt-1' : 'mt-2'}`}>
                              <div className={`w-2 h-2 rounded-full ${
                                passwordStrength.strength === 'strong' ? 'bg-brand' :
                                passwordStrength.strength === 'medium' ? 'bg-[#a3e635]' : 'bg-red-500'
                              }`} />
                              <span className={`${isMobile ? 'text-xs' : 'text-sm'} ${
                                passwordStrength.strength === 'strong' ? 'text-brand' :
                                passwordStrength.strength === 'medium' ? 'text-[#a3e635]' : 'text-red-600'
                              }`}>
                                {passwordStrength.feedback}
                              </span>
                            </div>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={passwordForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className={`${isMobile ? 'text-sm' : ''} text-gray-700`}>Confirm Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                {...field}
                                type={showPassword ? 'text' : 'password'}
                                className={`${isMobile ? 'h-[44px]' : 'h-12'} border-gray-300 ${isMobile ? 'rounded-md' : 'rounded-lg'} pr-10 bg-card border border-border text-foreground placeholder:text-muted-foreground focus:border-brand focus:border focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-brand focus-visible:border`}
                                placeholder="Confirm Password"
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className={`absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 ${isMobile ? 'min-h-[44px] min-w-[44px] flex items-center justify-center' : ''}`}
                              >
                                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                              </button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className={`flex ${isMobile ? 'gap-2' : 'gap-3'}`}>
                      <Button
                        type="button"
                        variant="outline"
                        className={`flex-1 ${isMobile ? 'h-[44px]' : 'h-12'} border-gray-300 ${isMobile ? 'rounded-md' : 'rounded-lg'} font-medium transition-all duration-200 ${isMobile ? '' : 'hover:scale-[1.02]'}`}
                        onClick={() => setCurrentStep(1)}
                        disabled={loading}
                      >
                        Back
                      </Button>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="submit"
                            className={`flex-1 ${isMobile ? 'h-[44px]' : 'h-12'} bg-brand hover:bg-brand-dark text-white ${isMobile ? 'rounded-md' : 'rounded-lg'} font-medium transition-all duration-200 ${isMobile ? '' : 'hover:scale-[1.02]'}`}
                            loading={loading}
                          >
                            Create Account
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Create my account</TooltipContent>
                      </Tooltip>
                    </div>
                  </form>
                </Form>
              )}

              {/* Legal: public signup step 1, or invite form (same page as signup) */}
              {((currentStep === 1 && !token) ||
                (token && inviteData && !isAuthenticated && !showWelcomeScreen)) && (
                <>
                  <p className="text-xs text-gray-500 mt-6 text-center">
                    By continuing, you are agreeing to African Business Suite's{' '}
                    <a href="#" className="text-brand hover:underline">Terms of Service</a>
                    {' '}and{' '}
                    <a href="#" className="text-brand hover:underline">Privacy Policy</a>.
                  </p>
                  {!token && !inviteData && (
                    <p className="text-sm text-gray-600 mt-4 text-center">
                      Already have an account?{' '}
                      <Link to="/login" className="text-brand hover:underline font-medium">
                        Sign in here
                      </Link>
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Right Section - Promotional - Hidden on mobile */}
          {!isMobile && (
            <div className="flex-1 bg-muted/30 relative hidden lg:flex items-center justify-center p-12">
              {/* Image Area - positioned relative to white container, ignoring padding */}
              <div className="absolute top-2 left-2 right-2 bottom-2 bg-muted rounded-xl flex items-center justify-center overflow-hidden">
                <img 
                  src={africanWomanImage} 
                  alt="Business professional" 
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="relative w-full h-full z-10">
                {/* Integration Cards Overlay */}
                <div className="absolute top-8 right-8 space-y-3">
                  <div className="bg-card border border-border p-4 w-48">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 bg-brand rounded flex items-center justify-center text-white font-bold text-sm">io</div>
                      <div className="flex-1 h-px bg-border"></div>
                    </div>
                    <div className="text-2xl font-semibold text-foreground">₵1,200.00</div>
                  </div>
                  <div className="bg-card border border-border p-4 w-48">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 bg-[#a3e635] rounded flex items-center justify-center text-brand font-bold text-sm">qb</div>
                      <div className="flex-1 h-px bg-border"></div>
                    </div>
                    <div className="text-2xl font-semibold text-foreground">₵1,200.00</div>
                  </div>
                  <div className="flex justify-center mt-2">
                    <div className="w-8 h-8 bg-card border border-border rounded-full flex items-center justify-center">
                      <RefreshCw className="h-4 w-4 text-gray-600" />
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>
    </div>
  );
};

export default Signup;
