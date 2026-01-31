import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, Mail, Loader2, Eye, EyeOff, RefreshCw } from 'lucide-react';
import authService from '../services/authService';
import inviteService from '../services/inviteService';
import { useAuth } from '../context/AuthContext';
import { useResponsive } from '../hooks/useResponsive';
import { showSuccess, showError } from '../utils/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { AlertCircle } from 'lucide-react';
import { calculatePasswordStrength } from '../utils/passwordStrength';
import africanWomanImage from '../assets/African focused woman.png';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import confetti from 'canvas-confetti';

/** Minimum time (ms) the loading animation runs before transitioning to success. Both lines: 0–2.6s first, 2.6–5.2s second. */
const MIN_LOADING_DISPLAY_MS = 5200;

const signupSchema = z.object({
  name: z.string().min(2, 'Please enter your full name'),
  email: z.string().email('Please enter a valid email address'),
});

const passwordSchema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(6, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match!",
  path: ["confirmPassword"],
});

/** Invite step 2: Full name + Password + Confirm password */
const inviteStep2Schema = z.object({
  name: z.string().min(2, 'Please enter your full name'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(6, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match!",
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
  const navigate = useNavigate();
  const { tenantSignup, isAuthenticated, activeTenant } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showWelcomeScreen, setShowWelcomeScreen] = useState(false);
  const [welcomeStatus, setWelcomeStatus] = useState('loading'); // 'loading' | 'success' | 'error'
  const [overlayPhase, setOverlayPhase] = useState('loading'); // 'loading' | 'success' | 'error'
  const [welcomeErrorMessage, setWelcomeErrorMessage] = useState('');
  const overlayStartTimeRef = useRef(null);
  const { isMobile } = useResponsive();

  // Mode detection from URL
  const modeParam = searchParams.get('mode');
  const validModes = ['shop', 'studio', 'pharmacy'];
  const selectedMode = validModes.includes(modeParam) ? modeParam : 'shop'; // Default to shop

  // Mode to businessType mapping
  const modeToBusinessType = {
    shop: 'shop',
    studio: 'printing_press',
    pharmacy: 'pharmacy'
  };

  // Copy for selected mode (shown in badge under tabs)
  const modeCopy = {
    shop: {
      contextLine: "You're setting up ShopWISE for Shops",
      subtext: "This workspace includes inventory, sales, and POS tools."
    },
    studio: {
      contextLine: "You're setting up ShopWISE for Studios",
      subtext: "This workspace includes print jobs, quotes, and production workflows."
    },
    pharmacy: {
      contextLine: "You're setting up ShopWISE for Pharmacies",
      subtext: "This workspace includes prescriptions and drug inventory."
    }
  };

  // Handle mode change via tabs
  const handleModeChange = (newMode) => {
    setSearchParams({ mode: newMode }, { replace: true });
  };

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
  useEffect(() => {
    if (isAuthenticated && !isSubmitting && !showWelcomeScreen) {
      const onboardingCompleted = activeTenant?.metadata?.onboarding?.completedAt;
      if (onboardingCompleted) {
        navigate('/dashboard', { replace: true });
      } else {
        navigate('/onboarding', { replace: true });
      }
    }
  }, [isAuthenticated, activeTenant, navigate, isSubmitting, showWelcomeScreen]);

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

  const token = searchParams.get('token');
  const passwordValue = passwordForm.watch('password');
  const invitePasswordValue = inviteStep2Form.watch('password');
  const activePassword = (token && inviteData && currentStep === 2) ? invitePasswordValue : passwordValue;

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

  // Pre-fill invite step 2 name when entering step 2 if backend provided it
  useEffect(() => {
    if (token && inviteData && currentStep === 2 && inviteData.name) {
      inviteStep2Form.setValue('name', inviteData.name);
    }
  }, [token, inviteData, currentStep]);

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
      setInviteData(response.data);
      // Invite flow always starts at step 1 (summary); do not skip to step 2
      setValidating(false);
    } catch (error) {
      console.log('Validate error:', error.response);
      setError(error.response?.data?.message || 'Invalid or expired invite token');
      setValidating(false);
    }
  };

  const onSubmit = async (values) => {
    // Step 1: Save name and email, move to password step (public signup only)
    setSignupData(values);
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
      await authService.register(registerData);
      const apiMs = Date.now() - apiStart;
      console.log('[Signup] Invite register API responded in', apiMs, 'ms');
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
      const businessType = modeToBusinessType[selectedMode];
      const payload = {
        companyName: signupData.name + "'s Workspace",
        companyEmail: signupData.email,
        adminName: signupData.name,
        adminEmail: signupData.email,
        password: values.password,
        plan: 'trial',
        businessType: businessType,
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

  if (validating) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100">
        <Loader2 className="h-8 w-8 animate-spin text-gray-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100 p-4">
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
    <div className={`min-h-screen bg-white flex items-center justify-center ${isMobile ? 'p-0' : 'p-8'}`}>
      {/* Full-screen welcome overlay (loading / success / error) */}
      {showWelcomeScreen && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center text-white p-6" style={{ backgroundColor: '#0E1801' }}>
          {overlayPhase === 'loading' && (
            <div className="w-full flex flex-col items-center justify-center text-center space-y-4">
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
              <h2 className="signup-welcome-line-1 text-3xl md:text-4xl font-semibold">Welcome to ShopWISE</h2>
              <h2 className="signup-welcome-line-2 text-3xl md:text-4xl font-semibold text-white whitespace-nowrap">The one platform you will ever need to transform your business.</h2>
            </div>
          )}
          {overlayPhase === 'success' && (
            <div className="text-center max-w-md space-y-6">
              <h2 className="text-3xl md:text-4xl font-semibold">Account created.</h2>
              <p className="text-lg text-gray-300">Continue to setup your workspace.</p>
              <Button
                className="bg-[#166534] hover:bg-[#14532d] text-white px-8 py-3 text-base"
                onClick={() => navigate('/onboarding', { replace: true })}
              >
                Continue to setup
              </Button>
            </div>
          )}
          {overlayPhase === 'error' && (
            <div className="text-center max-w-md space-y-6">
              <h2 className="text-3xl md:text-4xl font-semibold">We couldn&apos;t create your account.</h2>
              <p className="text-lg text-gray-300">{welcomeErrorMessage}</p>
              <Button
                className="bg-white text-black hover:bg-gray-100 px-8 py-3 text-base"
                onClick={() => {
                  setShowWelcomeScreen(false);
                  setWelcomeStatus('loading');
                  setWelcomeErrorMessage('');
                }}
              >
                Try again
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Main Content */}
      <div className={`w-full ${isMobile ? 'h-screen' : 'max-w-6xl bg-white rounded-2xl border border-gray-200'} overflow-hidden flex flex-col ${isMobile ? '' : 'lg:flex-row'}`}>
          {/* Left Section - Form */}
          <div className={`flex-1 ${isMobile ? 'px-6 py-4' : 'p-12'} flex flex-col justify-center ${isMobile ? 'min-h-screen overflow-y-auto' : ''}`}>
            <div className={`${isMobile ? 'w-full' : 'max-w-md'} mx-auto w-full`}>
              {/* Logo */}
              <h1 className={`${isMobile ? 'text-2xl mb-4' : 'text-3xl mb-8'} font-bold text-[#166534]`}>ShopWISE</h1>
              
              {/* Heading */}
              <h2 className={`${isMobile ? 'text-2xl mb-1' : 'text-3xl mb-2'} font-bold text-gray-900`}>
                {token && inviteData ? 'Join ShopWISE workspace' : 'Sign up'}
              </h2>
              {!token && !inviteData && (
                <p className={`${isMobile ? 'text-sm mb-6' : 'mb-8'} text-gray-600`}>One place for your business.</p>
              )}
              {token && inviteData && (
                <p className={`${isMobile ? 'text-sm mb-6' : 'mb-8'} text-gray-600`}>
                  You have been invited to join {inviteData.tenant?.name || 'this workspace'} as {inviteData.role ? String(inviteData.role).charAt(0).toUpperCase() + String(inviteData.role).slice(1) : 'a member'}.
                </p>
              )}

              {/* Mode Selection Tabs - Only show for public signup, not invites */}
              {!token && !inviteData && currentStep === 1 && (
                <div className={isMobile ? "mb-4" : "mb-6"}>
                  <Tabs value={selectedMode} onValueChange={handleModeChange} className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="shop" className={isMobile ? "text-xs px-2" : ""}>Shops</TabsTrigger>
                      <TabsTrigger value="studio" className={isMobile ? "text-xs px-2" : ""}>Studios</TabsTrigger>
                      <TabsTrigger value="pharmacy" className={isMobile ? "text-xs px-2" : ""}>Pharmacies</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <div className="mt-3 w-full flex flex-col gap-0.5 rounded-lg border border-[#166534] bg-[#166534]/5 px-3 py-2 text-left">
                    <span className="text-sm font-medium text-gray-900">
                      {modeCopy[selectedMode].contextLine}
                    </span>
                    <span className="text-xs text-gray-600">
                      {modeCopy[selectedMode].subtext}
                    </span>
                  </div>
                </div>
              )}

              {/* Invite step 1: summary only (email, role, tenant) + Continue */}
              {token && inviteData && currentStep === 1 ? (
                <Button
                  type="button"
                  className={`w-full ${isMobile ? 'h-[44px]' : 'h-12'} bg-[#166534] hover:bg-[#14532d] text-white ${isMobile ? 'rounded-md' : 'rounded-lg'} font-medium transition-all duration-200 ${isMobile ? '' : 'hover:scale-[1.02]'}`}
                  onClick={() => setCurrentStep(2)}
                >
                  Continue
                </Button>
              ) : token && inviteData && currentStep === 2 ? (
                /* Invite step 2: Full name, Password, Confirm password; show invited email */
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
                            className={`pl-10 ${isMobile ? 'h-[44px]' : 'h-12'} border-gray-300 ${isMobile ? 'rounded-md' : 'rounded-lg'} bg-gray-50 border text-gray-900 cursor-not-allowed`}
                          />
                        </div>
                      </div>
                    )}
                    <FormField
                      control={inviteStep2Form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className={`${isMobile ? 'text-sm' : ''} text-gray-700`}>Full Name</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <User className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4'} text-gray-400`} />
                              <Input
                                {...field}
                                className={`pl-10 ${isMobile ? 'h-[44px]' : 'h-12'} border-gray-300 ${isMobile ? 'rounded-md' : 'rounded-lg'} bg-white border text-gray-900 placeholder:text-gray-400 focus:border-[#166534] focus:border focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-[#166534] focus-visible:border`}
                                placeholder="Please enter your full name"
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
                                className={`${isMobile ? 'h-[44px]' : 'h-12'} border-gray-300 ${isMobile ? 'rounded-md' : 'rounded-lg'} pr-10 bg-white border text-gray-900 placeholder:text-gray-400 focus:border-[#166534] focus:border focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-[#166534] focus-visible:border`}
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
                                passwordStrength.strength === 'strong' ? 'bg-[#166534]' :
                                passwordStrength.strength === 'medium' ? 'bg-[#a3e635]' : 'bg-red-500'
                              }`} />
                              <span className={`${isMobile ? 'text-xs' : 'text-sm'} ${
                                passwordStrength.strength === 'strong' ? 'text-[#166534]' :
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
                                className={`${isMobile ? 'h-[44px]' : 'h-12'} border-gray-300 ${isMobile ? 'rounded-md' : 'rounded-lg'} pr-10 bg-white border text-gray-900 placeholder:text-gray-400 focus:border-[#166534] focus:border focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-[#166534] focus-visible:border`}
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
                      <Button
                        type="submit"
                        className={`flex-1 ${isMobile ? 'h-[44px]' : 'h-12'} bg-[#166534] hover:bg-[#14532d] text-white ${isMobile ? 'rounded-md' : 'rounded-lg'} font-medium transition-all duration-200 ${isMobile ? '' : 'hover:scale-[1.02]'}`}
                        loading={loading}
                      >
                        Create Account
                      </Button>
                    </div>
                  </form>
                </Form>
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
                            <FormLabel className={`${isMobile ? 'text-sm' : ''} text-gray-700`}>Full Name</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <User className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4'} text-gray-400`} />
                                <Input
                                  {...field}
                                  className={`pl-10 ${isMobile ? 'h-[44px]' : 'h-12'} border-gray-300 ${isMobile ? 'rounded-md' : 'rounded-lg'} bg-white border text-gray-900 placeholder:text-gray-400 focus:border-[#166534] focus:border focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-[#166534] focus-visible:border`}
                                  placeholder="Please enter your full name"
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
                                  className={`pl-10 ${isMobile ? 'h-[44px]' : 'h-12'} border-gray-300 ${isMobile ? 'rounded-md' : 'rounded-lg'} bg-white border text-gray-900 placeholder:text-gray-400 focus:border-[#166534] focus:border focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-[#166534] focus-visible:border`}
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
                        className={`w-full ${isMobile ? 'h-[44px]' : 'h-12'} bg-[#166534] hover:bg-[#14532d] text-white ${isMobile ? 'rounded-md' : 'rounded-lg'} font-medium transition-all duration-200 ${isMobile ? '' : 'hover:scale-[1.02]'}`}
                        disabled={loading}
                      >
                        Continue
                      </Button>
                    </form>
                  </Form>
                </>
              ) : (
                /* Public signup step 2: Password + Confirm password */
                <Form {...passwordForm}>
                  <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className={isMobile ? "space-y-4" : "space-y-6"}>
                    <div className={isMobile ? "mb-3" : "mb-4"}>
                      <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-gray-600`}>
                        Welcome, <strong>{signupData.name}</strong>! Let's set up your password.
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
                                className={`${isMobile ? 'h-[44px]' : 'h-12'} border-gray-300 ${isMobile ? 'rounded-md' : 'rounded-lg'} pr-10 bg-white border text-gray-900 placeholder:text-gray-400 focus:border-[#166534] focus:border focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-[#166534] focus-visible:border`}
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
                                passwordStrength.strength === 'strong' ? 'bg-[#166534]' :
                                passwordStrength.strength === 'medium' ? 'bg-[#a3e635]' : 'bg-red-500'
                              }`} />
                              <span className={`${isMobile ? 'text-xs' : 'text-sm'} ${
                                passwordStrength.strength === 'strong' ? 'text-[#166534]' :
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
                                className={`${isMobile ? 'h-[44px]' : 'h-12'} border-gray-300 ${isMobile ? 'rounded-md' : 'rounded-lg'} pr-10 bg-white border text-gray-900 placeholder:text-gray-400 focus:border-[#166534] focus:border focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-[#166534] focus-visible:border`}
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
                      <Button
                        type="submit"
                        className={`flex-1 ${isMobile ? 'h-[44px]' : 'h-12'} bg-[#166534] hover:bg-[#14532d] text-white ${isMobile ? 'rounded-md' : 'rounded-lg'} font-medium transition-all duration-200 ${isMobile ? '' : 'hover:scale-[1.02]'}`}
                        loading={loading}
                      >
                        Create Account
                      </Button>
                    </div>
                  </form>
                </Form>
              )}

              {/* Legal Text - only show on first step */}
              {currentStep === 1 && (
                <>
                  <p className="text-xs text-gray-500 mt-6 text-center">
                    By continuing, you are agreeing to ShopWISE's{' '}
                    <a href="#" className="text-[#166534] hover:underline">Terms of Service</a>
                    {' '}and{' '}
                    <a href="#" className="text-[#166534] hover:underline">Privacy Policy</a>.
                  </p>
                  {!token && !inviteData && (
                    <p className="text-sm text-gray-600 mt-4 text-center">
                      Already have an account?{' '}
                      <Link to="/login" className="text-[#166534] hover:underline font-medium">
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
            <div className="flex-1 bg-white relative hidden lg:flex items-center justify-center p-12">
              {/* Image Area - positioned relative to white container, ignoring padding */}
              <div className="absolute top-2 left-2 right-2 bottom-2 bg-gray-50 rounded-xl flex items-center justify-center overflow-hidden">
                <img 
                  src={africanWomanImage} 
                  alt="Business professional" 
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="relative w-full h-full z-10">
                {/* Integration Cards Overlay */}
                <div className="absolute top-8 right-8 space-y-3">
                  <div className="bg-white border border-gray-200 p-4 w-48">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 bg-[#166534] rounded flex items-center justify-center text-white font-bold text-sm">io</div>
                      <div className="flex-1 h-px bg-gray-200"></div>
                    </div>
                    <div className="text-2xl font-semibold text-gray-900">$1,200.00</div>
                  </div>
                  <div className="bg-white border border-gray-200 p-4 w-48">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 bg-[#a3e635] rounded flex items-center justify-center text-[#166534] font-bold text-sm">qb</div>
                      <div className="flex-1 h-px bg-gray-200"></div>
                    </div>
                    <div className="text-2xl font-semibold text-gray-900">$1,200.00</div>
                  </div>
                  <div className="flex justify-center mt-2">
                    <div className="w-8 h-8 bg-white border border-gray-200 rounded-full flex items-center justify-center">
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
