import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { showSuccess, showError } from '../utils/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  email: z.string().email('Please enter a valid email!').min(1, 'Please input your email!'),
  password: z.string().min(1, 'Please input your password!'),
});

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const form = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (values) => {
    setLoading(true);
    try {
      const response = await login(values);
      const payload = response?.data || response || {};
      showSuccess('Login successful!');
      const user = payload?.user;
      if (user?.isPlatformAdmin) {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (error) {
      showError(error, 'Invalid email or password. Please check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  };

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
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome back</h2>
              <p className="text-gray-600 mb-8">Sign in to manage your workspace and keep every job on track.</p>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-700">Email</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="you@company.com"
                            className="h-12 border-gray-300 rounded-lg bg-green-50 text-gray-900 placeholder:text-gray-400 focus:border-[#166534] focus:border focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-[#166534] focus-visible:border"
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
                        <FormLabel className="text-gray-700">Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showPassword ? 'text' : 'password'}
                              placeholder="Enter password"
                              className="h-12 border-gray-300 rounded-lg pr-10 bg-green-50 text-gray-900 placeholder:text-gray-400 focus:border-[#166534] focus:border focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-[#166534] focus-visible:border"
                              {...field}
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

                  <Button
                    type="submit"
                    className="w-full h-12 bg-[#166534] hover:bg-[#14532d] text-white rounded-lg font-medium transition-all duration-200 hover:scale-[1.02]"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Logging in...
                      </>
                    ) : (
                      'Log in'
                    )}
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

              {/* Google Sign In Button */}
              <Button
                type="button"
                variant="outline"
                className="w-full h-12 border-gray-300 rounded-lg font-medium flex items-center justify-center gap-3 bg-white text-gray-900 hover:!bg-green-50 hover:!border-[#166534] hover:!text-gray-900 transition-all duration-200 hover:scale-[1.02]"
                onClick={() => {
                  // TODO: Implement Google OAuth signin
                  showError('Google signin is coming soon!');
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
                Sign in with Google
              </Button>

              <div className="text-center mt-6">
                <p className="text-sm text-gray-500">
                  Don't have an account yet?{' '}
                  <a href="/signup" className="text-[#166534] hover:underline font-medium">
                    Sign up here
                  </a>
                </p>
              </div>
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

export default Login;
