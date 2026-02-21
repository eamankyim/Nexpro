import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import authService from '../services/authService';
import { useResponsive } from '../hooks/useResponsive';
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

const resetSchema = z
  .object({
    newPassword: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(6, 'Confirm your password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

const ResetPassword = () => {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const { isMobile } = useResponsive();

  const form = useForm({
    resolver: zodResolver(resetSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  const onSubmit = async (values) => {
    if (!token) {
      showError('Invalid reset link. Please request a new password reset.');
      return;
    }
    setLoading(true);
    try {
      await authService.resetPassword(token, values.newPassword);
      showSuccess('Password has been reset. You can now sign in.');
      navigate('/login', { replace: true });
    } catch (error) {
      showError(error, 'Could not reset password. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-md text-center">
          <h1 className="text-3xl font-bold text-[#166534] mb-4">ShopWISE</h1>
          <p className="text-muted-foreground mb-4">Invalid or missing reset link. Please request a new password reset.</p>
          <Link to="/forgot-password" className="text-[#166534] hover:underline font-medium">
            Request new link
          </Link>
          <span className="text-muted-foreground mx-2">or</span>
          <Link to="/login" className="text-[#166534] hover:underline font-medium">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-0 md:p-8">
      <div className={`w-full ${isMobile ? 'h-screen' : 'max-w-md bg-card rounded-2xl border border-border'} overflow-hidden flex flex-col ${isMobile ? 'px-6 py-4' : 'p-12'}`}>
        <h1 className={`${isMobile ? 'text-2xl mb-4' : 'text-3xl mb-8'} font-bold text-[#166534]`}>ShopWISE</h1>

        <h2 className={`${isMobile ? 'text-2xl mb-1' : 'text-3xl mb-2'} font-bold text-foreground`}>Set new password</h2>
        <p className={`${isMobile ? 'text-sm mb-6' : 'mb-8'} text-muted-foreground`}>
          Enter your new password below.
        </p>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className={isMobile ? 'space-y-4' : 'space-y-6'}>
            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={`${isMobile ? 'text-sm' : ''} text-foreground`}>New password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="At least 6 characters"
                        autoComplete="new-password"
                        className={`${isMobile ? 'h-[44px]' : 'h-12'} pr-10 border-input ${isMobile ? 'rounded-md' : 'rounded-lg'} bg-background border text-foreground focus:border-primary focus:border focus:ring-0`}
                        {...field}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={`${isMobile ? 'text-sm' : ''} text-foreground`}>Confirm password</FormLabel>
                  <FormControl>
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Confirm new password"
                      autoComplete="new-password"
                      className={`${isMobile ? 'h-[44px]' : 'h-12'} border-input ${isMobile ? 'rounded-md' : 'rounded-lg'} bg-background border text-foreground focus:border-primary focus:border focus:ring-0`}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              className={`w-full ${isMobile ? 'h-[44px]' : 'h-12'} bg-[#166534] hover:bg-[#14532d] text-white ${isMobile ? 'rounded-md' : 'rounded-lg'} font-medium`}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resetting...
                </>
              ) : (
                'Reset password'
              )}
            </Button>
          </form>
        </Form>

        <div className={`text-center ${isMobile ? 'mt-4' : 'mt-6'}`}>
          <Link to="/login" className="text-sm text-[#166534] hover:underline font-medium">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
