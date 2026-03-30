import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams, Link, Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { GoogleLogin } from '@react-oauth/google';
import { Eye, EyeOff, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePublicConfig } from '../context/PublicConfigContext';
import { useResponsive } from '../hooks/useResponsive';
import { showSuccess, showError } from '../utils/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import africanWomanImage from '../assets/African focused woman.png';

const loginSchema = z.object({
  email: z.string().min(1, 'Enter your email').email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
});

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, googleAuth } = useAuth();
  const { googleClientId, configLoaded } = usePublicConfig();
  useEffect(() => {
    console.log('[Login] googleClientId:', googleClientId ? `${googleClientId.substring(0, 15)}...` : '(empty)', 'configLoaded=', configLoaded, 'showGoogleButton=', Boolean(googleClientId));
  }, [googleClientId, configLoaded]);
  const planParam = searchParams.get('plan');
  const billingPeriodParam = searchParams.get('billingPeriod');
  const inviteTokenParam = searchParams.get('token');
  const validPlans = ['starter', 'professional'];
  const validPeriods = ['monthly', 'yearly'];
  const hasCheckoutParams = validPlans.includes(planParam) && validPeriods.includes(billingPeriodParam);
  const { isMobile } = useResponsive();
  const whatsappContactUrl =
    (import.meta.env.VITE_WHATSAPP_CONTACT_URL || '').trim() ||
    'https://wa.me/233555155972?text=' +
      encodeURIComponent(
        "Hi, I don't have an ABS account yet. Please help me create one for my business."
      );

  const form = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const [emailNotFound, setEmailNotFound] = useState(false);
  const emailValue = form.watch('email');
  useEffect(() => {
    if (emailNotFound && emailValue) setEmailNotFound(false);
  }, [emailValue]);

  const onSubmit = async (values) => {
    setLoading(true);
    setEmailNotFound(false);
    try {
      const response = await login(values);
      const payload = response?.data || response || {};
      showSuccess('Login successful!');
      const user = payload?.user;
      const memberships = payload?.memberships || [];
      const defaultMembership =
        memberships.find((m) => m.isDefault) || memberships[0] || null;
      const onboardingCompleted =
        defaultMembership?.tenant?.metadata?.onboarding?.completedAt;
      const isInvitedTenantUser = Boolean(defaultMembership?.invitedBy);

      if (user?.isPlatformAdmin) {
        navigate('/admin');
      } else if (hasCheckoutParams) {
        navigate('/checkout', {
          state: { plan: planParam, billingPeriod: billingPeriodParam },
        });
      } else if (!onboardingCompleted && !isInvitedTenantUser) {
        navigate('/onboarding');
      } else {
        navigate('/dashboard');
      }
    } catch (error) {
      const errorCode = error?.response?.data?.errorCode;
      const message = error?.response?.data?.message;
      if (errorCode === 'EMAIL_NOT_FOUND' || (error?.response?.status === 404 && message)) {
        setEmailNotFound(true);
        showError(message || 'No account exists for this email. Sign up instead.');
      } else {
        showError(error, message || 'Wrong email or password. Check and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = useCallback(
    async (credentialResponse) => {
      const idToken = credentialResponse?.credential;
      if (!idToken) return;
      setGoogleLoading(true);
      try {
        const response = await googleAuth(idToken, { signUp: false });
        const payload = response?.data || response || {};
        showSuccess('Login successful!');
        const user = payload?.user;
        const memberships = payload?.memberships || [];
        const defaultMembership =
          memberships.find((m) => m.isDefault) || memberships[0] || null;
        const onboardingCompleted =
          defaultMembership?.tenant?.metadata?.onboarding?.completedAt;
        const isInvitedTenantUser = Boolean(defaultMembership?.invitedBy);

        if (user?.isPlatformAdmin) {
          navigate('/admin');
        } else if (hasCheckoutParams) {
          navigate('/checkout', {
            state: { plan: planParam, billingPeriod: billingPeriodParam },
          });
        } else if (!onboardingCompleted && !isInvitedTenantUser) {
          navigate('/onboarding');
        } else {
          navigate('/dashboard');
        }
      } catch (err) {
        const code = err?.response?.data?.code;
        const message = err?.response?.data?.message;
        if (code === 'GOOGLE_USER_NOT_FOUND') {
          showError(message || 'No account found. Sign up first.', 'Sign up to create an account');
          navigate('/signup', { state: { fromGoogle: true, email: err?.response?.data?.email, name: err?.response?.data?.name } });
        } else {
          showError(err, message || 'Google sign-in failed.');
        }
      } finally {
        setGoogleLoading(false);
      }
    },
    [googleAuth, navigate, hasCheckoutParams, planParam, billingPeriodParam]
  );

  const handleGoogleError = useCallback(() => {
    showError('Google sign-in was cancelled or failed.');
    setGoogleLoading(false);
  }, []);

  if (inviteTokenParam) {
    return <Navigate to={`/signup?token=${encodeURIComponent(inviteTokenParam)}`} replace />;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-0 md:p-8">
      {/* Main Content */}
      <div className={`w-full ${isMobile ? 'h-screen' : 'max-w-6xl bg-card rounded-2xl border border-border'} overflow-hidden flex flex-col ${isMobile ? '' : 'lg:flex-row'}`}>
          {/* Left Section - Form */}
          <div className={`flex-1 ${isMobile ? 'px-6 py-4' : 'p-12'} flex flex-col justify-center ${isMobile ? 'min-h-screen' : ''}`}>
            <div className={`${isMobile ? 'w-full' : 'max-w-md'} mx-auto w-full`}>
              {/* Logo */}
              <h1 className={`${isMobile ? 'text-2xl mb-4' : 'text-3xl mb-8'} font-bold text-brand`}>ABS</h1>
              
              {/* Heading */}
              <h2 className={`${isMobile ? 'text-2xl mb-1' : 'text-3xl mb-2'} font-bold text-foreground`}>Welcome back</h2>
              <p className={`${isMobile ? 'text-sm mb-6' : 'mb-8'} text-muted-foreground`}>Sign in to manage your business and keep every job on track.</p>

              {emailNotFound && (
                <div className="mb-4 p-4 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 text-foreground">
                  <p className="text-sm mb-2">No account exists for this email. Sign up instead.</p>
                  <Link to="/signup" className="text-sm font-medium text-brand hover:underline">
                    Create an account
                  </Link>
                </div>
              )}

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className={isMobile ? "space-y-4" : "space-y-6"}>
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={`${isMobile ? 'text-sm' : ''} text-foreground`}>Email</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="example@mail.com"
                            className={`${isMobile ? 'h-[44px]' : 'h-12'} border-input ${isMobile ? 'rounded-md' : 'rounded-lg'} bg-background border text-foreground placeholder:text-muted-foreground focus:border-primary focus:border focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary focus-visible:border`}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={`${isMobile ? 'text-sm' : ''} text-foreground`}>Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showPassword ? 'text' : 'password'}
                              placeholder="Enter password"
                              className={`${isMobile ? 'h-[44px]' : 'h-12'} border-input ${isMobile ? 'rounded-md' : 'rounded-lg'} pr-10 bg-background border text-foreground placeholder:text-muted-foreground focus:border-primary focus:border focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary focus-visible:border`}
                              {...field}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className={`absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground ${isMobile ? 'min-h-[44px] min-w-[44px] flex items-center justify-center' : ''}`}
                            >
                              {showPassword ? (
                                <EyeOff className="h-5 w-5" />
                              ) : (
                                <Eye className="h-5 w-5" />
                              )}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                        <div className="flex justify-end mt-1">
                          <Link to="/forgot-password" className="text-sm text-brand hover:underline">
                            Forgot password?
                          </Link>
                        </div>
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
                        Log in
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Enter to open your account</TooltipContent>
                  </Tooltip>
                </form>
              </Form>

              <div className={`relative ${isMobile ? 'my-4' : 'my-6'}`}>
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border"></span>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className={`${isMobile ? 'bg-card px-2' : 'bg-card px-2'} text-muted-foreground`}>Or</span>
                </div>
              </div>

              {/* Google Sign In Button - min-height so space is reserved while script loads */}
              {googleClientId ? (
                <div className="flex justify-center min-h-[44px]" data-google-configured="true">
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={handleGoogleError}
                    useOneTap={false}
                    theme="outline"
                    size="large"
                    type="standard"
                    shape="rectangular"
                    text="signin_with"
                    width={isMobile ? 320 : 400}
                  />
                </div>
              ) : configLoaded ? null : (
                <div className="flex justify-center min-h-[44px] items-center text-muted-foreground text-sm">
                  Loading sign-in options...
                </div>
              )}

              <div className={`text-center ${isMobile ? 'mt-4' : 'mt-6'}`}>
                {/* For now always show Contact administrator; signup route /signup and Signup.jsx remain for invite links */}
                <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground`}>
                  Don&apos;t have an account?{' '}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <a
                        href={whatsappContactUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand hover:underline font-medium"
                      >
                        Contact administrator
                      </a>
                    </TooltipTrigger>
                    <TooltipContent>
                      We&apos;ll help you set up an account.
                    </TooltipContent>
                  </Tooltip>
                </p>
              </div>
            </div>
          </div>

          {/* Right Section - Promotional - Hidden on mobile */}
          {!isMobile && (
            <div className="flex-1 bg-card relative hidden lg:flex items-center justify-center p-12">
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
                      <RefreshCw className="h-4 w-4 text-muted-foreground" />
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

export default Login;
