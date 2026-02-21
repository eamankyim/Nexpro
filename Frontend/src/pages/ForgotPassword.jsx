import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, CheckCircle2 } from 'lucide-react';
import authService from '../services/authService';
import { useResponsive } from '../hooks/useResponsive';
import { showError } from '../utils/toast';
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

const forgotSchema = z.object({
  email: z.string().min(1, 'Enter your email').email('Enter a valid email'),
});

const ForgotPassword = () => {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { isMobile } = useResponsive();

  const form = useForm({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (values) => {
    setLoading(true);
    try {
      await authService.requestPasswordReset(values.email);
      setSubmitted(true);
    } catch (error) {
      showError(error, 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-0 md:p-8">
      <div className={`w-full ${isMobile ? 'h-screen' : 'max-w-md bg-card rounded-2xl border border-border'} overflow-hidden flex flex-col ${isMobile ? 'px-6 py-4' : 'p-12'}`}>
        <h1 className={`${isMobile ? 'text-2xl mb-4' : 'text-3xl mb-8'} font-bold text-[#166534] text-center`}>ShopWISE</h1>

        {!submitted && (
          <>
            <h2 className={`${isMobile ? 'text-2xl mb-1' : 'text-3xl mb-2'} font-bold text-foreground text-center`}>Forgot password?</h2>
            <p className={`${isMobile ? 'text-sm mb-6' : 'mb-8'} text-muted-foreground text-center`}>
              Enter your email and we&apos;ll send you a link to reset your password.
            </p>
          </>
        )}

        {submitted ? (
          <div className="flex flex-col items-center text-center space-y-5 py-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#166534]/10 border border-[#166534]/20">
              <CheckCircle2 className="h-8 w-8 text-[#166534]" aria-hidden />
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-foreground text-lg">Check your email</h3>
              <p className="text-sm text-muted-foreground max-w-[280px]">
                If an account exists for that email, we&apos;ve sent a password reset link. The link expires in 1 hour.
              </p>
              <p className="text-xs text-muted-foreground">
                Didn&apos;t see it? Check your spam folder.
              </p>
            </div>
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-lg bg-[#166534] hover:bg-[#14532d] text-white font-medium h-12 px-6 w-full max-w-[240px] transition-colors"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className={isMobile ? 'space-y-4' : 'space-y-6'}>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={`${isMobile ? 'text-sm' : ''} text-foreground`}>Email</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="example@mail.com"
                        type="email"
                        autoComplete="email"
                        className={`${isMobile ? 'h-[44px]' : 'h-12'} border-input ${isMobile ? 'rounded-md' : 'rounded-lg'} bg-background border text-foreground placeholder:text-muted-foreground focus:border-primary focus:border focus:ring-0`}
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
                    Sending...
                  </>
                ) : (
                  'Send reset link'
                )}
              </Button>
            </form>
          </Form>
        )}

        {!submitted && (
          <div className={`text-center ${isMobile ? 'mt-4' : 'mt-6'}`}>
            <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground`}>
              Remember your password?{' '}
              <Link to="/login" className="text-[#166534] hover:underline font-medium">
                Sign in
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
