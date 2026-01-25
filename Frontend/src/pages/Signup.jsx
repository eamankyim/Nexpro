import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, Lock, Mail, Loader2, Eye, EyeOff, RefreshCw } from 'lucide-react';
import authService from '../services/authService';
import inviteService from '../services/inviteService';
import { useAuth } from '../context/AuthContext';
import { showSuccess, showError } from '../utils/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { AlertCircle, Info } from 'lucide-react';
import { calculatePasswordStrength } from '../utils/passwordStrength';
import africanWomanImage from '../assets/African focused woman.png';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

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

  // Contextual copy based on mode
  const modeCopy = {
    shop: {
      contextLine: "You're setting up Nexpro for Shops",
      subtext: "This workspace includes inventory, sales, and POS tools."
    },
    studio: {
      contextLine: "You're setting up Nexpro for Studios",
      subtext: "This workspace includes print jobs, quotes, and production workflows."
    },
    pharmacy: {
      contextLine: "You're setting up Nexpro for Pharmacies",
      subtext: "This workspace includes prescriptions, drug inventory, and patient records."
    }
  };

  // Handle mode change via tabs
  const handleModeChange = (newMode) => {
    setSearchParams({ mode: newMode }, { replace: true });
  };

  // Redirect authenticated users only if they're not in the signup process
  // Check if onboarding is completed by checking tenant metadata
  useEffect(() => {
    if (isAuthenticated && !isSubmitting) {
      // Check if onboarding is completed
      const onboardingCompleted = activeTenant?.metadata?.onboarding?.completedAt;
      if (onboardingCompleted) {
        // User already completed onboarding, redirect to dashboard
        navigate('/dashboard', { replace: true });
      } else {
        // User is authenticated but hasn't completed onboarding, redirect to onboarding
        navigate('/onboarding', { replace: true });
      }
    }
  }, [isAuthenticated, activeTenant, navigate, isSubmitting]);

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

  const passwordValue = passwordForm.watch('password');

  const token = searchParams.get('token');

  useEffect(() => {
    // Only validate invite token if token is provided
    if (token) {
      validateInviteToken();
    } else {
      setValidating(false);
    }
  }, [token]);

  useEffect(() => {
    if (passwordValue) {
      const strength = calculatePasswordStrength(passwordValue);
      setPasswordStrength(strength);
    } else {
      setPasswordStrength({ strength: 'weak', feedback: '' });
    }
  }, [passwordValue]);

  const validateInviteToken = async () => {
    if (!token) {
      setValidating(false);
      return;
    }

    setValidating(true);
    try {
      const response = await inviteService.validateInvite(token);
      setInviteData(response.data);
      
      // Pre-fill form if name provided
      if (response.data.name) {
        form.setValue('name', response.data.name);
        setSignupData(prev => ({ ...prev, name: response.data.name }));
      }
      if (response.data.email) {
        form.setValue('email', response.data.email);
        setSignupData(prev => ({ ...prev, email: response.data.email }));
      }
      
      // If invite has email pre-filled, skip to password step
      if (response.data.email) {
        setCurrentStep(2);
      }
      
      setValidating(false);
    } catch (error) {
      console.log('Validate error:', error.response);
      setError(error.response?.data?.message || 'Invalid or expired invite token');
      setValidating(false);
    }
  };

  const onSubmit = async (values) => {
    // Step 1: Save name and email, move to password step
    setSignupData(values);
    setCurrentStep(2);
  };

  const onPasswordSubmit = async (values) => {
    setLoading(true);
    setIsSubmitting(true);
    try {
      // If there's an invite token, use the invite flow
      if (token) {
        const registerData = {
          name: signupData.name,
          email: signupData.email,
          password: values.password,
          inviteToken: token
        };

        const response = await authService.register(registerData);
        showSuccess('Account created successfully! Setting up your workspace...');
        
        // Navigate immediately to onboarding, don't wait
        navigate('/onboarding', { replace: true });
      } else {
        // Public signup - create tenant and user
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

        await tenantSignup(payload);
        showSuccess('Account created successfully! Setting up your workspace...');
        
        // Navigate immediately to onboarding, don't wait
        navigate('/onboarding', { replace: true });
      }
    } catch (error) {
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to create account. Please check your information and try again.';
      showError(error, errorMessage);
      setIsSubmitting(false);
    } finally {
      setLoading(false);
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
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-8">
      {/* Main Content */}
      <div className="w-full max-w-6xl bg-white rounded-2xl overflow-hidden flex">
          {/* Left Section - Form */}
          <div className="flex-1 p-12 flex flex-col justify-center">
            <div className="max-w-md mx-auto w-full">
              {/* Logo */}
              <h1 className="text-3xl font-bold text-[#166534] mb-8">nexpro</h1>
              
              {/* Heading */}
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Create your Nexpro workspace</h2>
              {!token && !inviteData && (
                <p className="text-gray-600 mb-8">Manage your business operations in one place.</p>
              )}
              {token && inviteData && (
                <p className="text-gray-600 mb-8">You've been invited to join a workspace.</p>
              )}

              {/* Invite Info Alert */}
              {inviteData && (
                <Alert className="mb-6">
                  <Info className="h-4 w-4" />
                  <AlertTitle>Invite for {inviteData.email}</AlertTitle>
                  <AlertDescription className="mt-2">
                    <div>You've been invited to join as <strong>{inviteData.role}</strong>.</div>
                    {inviteData.tenant?.name && (
                      <div className="mt-2">
                        Joining organisation: <strong>{inviteData.tenant.name}</strong>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {/* Mode Selection Tabs - Only show for public signup, not invites */}
              {!token && !inviteData && currentStep === 1 && (
                <div className="mb-6">
                  <Tabs value={selectedMode} onValueChange={handleModeChange} className="w-full">
                    <TabsList className="grid w-full grid-cols-3 mb-4">
                      <TabsTrigger value="shop">Shops</TabsTrigger>
                      <TabsTrigger value="studio">Studios</TabsTrigger>
                      <TabsTrigger value="pharmacy">Pharmacies</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <div className="mb-6">
                    <p className="text-sm font-medium text-gray-900 mb-1">
                      {modeCopy[selectedMode].contextLine}
                    </p>
                    <p className="text-xs text-gray-600">
                      {modeCopy[selectedMode].subtext}
                    </p>
                  </div>
                </div>
              )}

              {currentStep === 1 ? (
                <>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-700">Full Name</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                              <Input 
                                {...field}
                                className="pl-10 h-12 border-gray-300 rounded-lg bg-green-50 text-gray-900 placeholder:text-gray-400 focus:border-[#166534] focus:border focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-[#166534] focus-visible:border"
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
                            <FormLabel className="text-gray-700">Email</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                              <Input 
                                {...field}
                                className="pl-10 h-12 border-gray-300 rounded-lg bg-green-50 text-gray-900 placeholder:text-gray-400 focus:border-[#166534] focus:border focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-[#166534] focus-visible:border"
                                placeholder="Please enter a valid email address" 
                                disabled={!!inviteData}
                              />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                    <Button 
                      type="submit" 
                      className="w-full h-12 bg-[#166534] hover:bg-[#14532d] text-white rounded-lg font-medium transition-all duration-200 hover:scale-[1.02]"
                      disabled={loading}
                    >
                      Continue
                    </Button>
                  </form>
                </Form>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-gray-300"></span>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-gray-500">Or</span>
                  </div>
                </div>

                {/* Google Sign Up Button */}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12 border-gray-300 rounded-lg font-medium flex items-center justify-center gap-3 bg-white text-gray-900 hover:!bg-green-50 hover:!border-[#166534] hover:!text-gray-900 transition-all duration-200 hover:scale-[1.02]"
                  onClick={() => {
                    // TODO: Implement Google OAuth signup
                    showError('Google signup is coming soon!');
                  }}
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Sign up with Google
                </Button>
                </>
              ) : (
                <Form {...passwordForm}>
                  <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-6">
                    <div className="mb-4">
                      <p className="text-sm text-gray-600">
                        Welcome, <strong>{signupData.name}</strong>! Let's set up your password.
                      </p>
                    </div>

                    <FormField
                      control={passwordForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-700">Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input 
                                {...field}
                                type={showPassword ? 'text' : 'password'}
                                className="h-12 border-gray-300 rounded-lg pr-10 bg-green-50 text-gray-900 placeholder:text-gray-400 focus:border-[#166534] focus:border focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-[#166534] focus-visible:border"
                                placeholder="Password" 
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                              >
                                {showPassword ? (
                                  <EyeOff className="h-5 w-5" />
                                ) : (
                                  <Eye className="h-5 w-5" />
                                )}
                              </button>
                            </div>
                          </FormControl>
                          {passwordValue && passwordStrength.feedback && (
                            <div className="flex items-center gap-2 mt-2">
                              <div className={`w-2 h-2 rounded-full ${
                                passwordStrength.strength === 'strong' ? 'bg-[#166534]' :
                                passwordStrength.strength === 'medium' ? 'bg-[#a3e635]' :
                                'bg-red-500'
                              }`} />
                              <span className={`text-sm ${
                                passwordStrength.strength === 'strong' ? 'text-[#166534]' :
                                passwordStrength.strength === 'medium' ? 'text-[#a3e635]' :
                                'text-red-600'
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
                          <FormLabel className="text-gray-700">Confirm Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input 
                                {...field}
                                type={showPassword ? 'text' : 'password'}
                                className="h-12 border-gray-300 rounded-lg pr-10 bg-green-50 text-gray-900 placeholder:text-gray-400 focus:border-[#166534] focus:border focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-[#166534] focus-visible:border"
                                placeholder="Confirm Password" 
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
                        </FormItem>
                      )}
                    />

                    <div className="flex gap-3">
                      <Button 
                        type="button"
                        variant="outline"
                        className="flex-1 h-12 border-gray-300 rounded-lg font-medium transition-all duration-200 hover:scale-[1.02]"
                        onClick={() => setCurrentStep(1)}
                        disabled={loading}
                      >
                        Back
                      </Button>
                      <Button 
                        type="submit" 
                        className="flex-1 h-12 bg-[#166534] hover:bg-[#14532d] text-white rounded-lg font-medium transition-all duration-200 hover:scale-[1.02]"
                        disabled={loading}
                      >
                        {loading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating Account...
                          </>
                        ) : (
                          'Create Account'
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              )}

              {/* Legal Text - only show on first step */}
              {currentStep === 1 && (
                <>
                  <p className="text-xs text-gray-500 mt-6 text-center">
                    By continuing, you are agreeing to Nexpro's{' '}
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

          {/* Right Section - Promotional */}
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
                <div className="bg-white rounded-lg shadow-lg p-4 w-48">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-[#166534] rounded flex items-center justify-center text-white font-bold text-sm">io</div>
                    <div className="flex-1 h-px bg-gray-200"></div>
                  </div>
                  <div className="text-2xl font-semibold text-gray-900">$1,200.00</div>
                </div>
                <div className="bg-white rounded-lg shadow-lg p-4 w-48">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-[#a3e635] rounded flex items-center justify-center text-[#166534] font-bold text-sm">qb</div>
                    <div className="flex-1 h-px bg-gray-200"></div>
                  </div>
                  <div className="text-2xl font-semibold text-gray-900">$1,200.00</div>
                </div>
                <div className="flex justify-center mt-2">
                  <div className="w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center">
                    <RefreshCw className="h-4 w-4 text-gray-600" />
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
    </div>
  );
};

export default Signup;
