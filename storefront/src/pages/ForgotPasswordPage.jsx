import { useCallback, useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, Mail } from 'lucide-react';

import authService from '../services/authService';
import { showError } from '../utils/toast';
import { Breadcrumbs, PageShell } from '../components/storefront/StorefrontLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const ForgotPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const returnTo = useMemo(() => {
    const requested = searchParams.get('returnTo') || location.state?.returnTo || '';
    return requested.startsWith('/') && !requested.startsWith('//') ? requested : '/';
  }, [location.state?.returnTo, searchParams]);

  const handleSubmit = useCallback(async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await authService.requestPasswordReset(email, returnTo);
      setSubmitted(true);
    } catch (error) {
      showError(error, 'Could not request a password reset. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [email]);

  return (
    <PageShell activePath="/login">
      <Breadcrumbs items={[{ label: 'Forgot password' }]} />
      <section className="mx-auto max-w-xl rounded-2xl border border-green-200 bg-white p-6 sm:rounded-[2rem] md:p-8">
        {submitted ? (
          <div className="text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-green-200 bg-green-50 text-green-800">
              <CheckCircle2 className="h-8 w-8" />
            </span>
            <h1 className="mt-5 text-3xl font-black text-slate-950">Check your email</h1>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-500">
              If a shopper account exists for that email, we sent a reset link. The link expires in 1 hour.
            </p>
            <Button asChild className="mt-6 rounded-full bg-green-700 hover:bg-green-800">
              <Link to={`/login?returnTo=${encodeURIComponent(returnTo)}`}>Back to sign in</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-green-200 bg-green-50 text-green-800">
              <Mail className="h-7 w-7" />
            </span>
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-green-700">Account recovery</p>
              <h1 className="mt-2 text-3xl font-black text-slate-950">Reset your shopper password</h1>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                Enter the email for your Sabito Store shopper account and we will send a secure reset link.
              </p>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-semibold text-slate-700" htmlFor="email">Email</label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button asChild type="button" variant="outline" className="rounded-full border-green-200 text-green-800 hover:bg-green-50">
                <Link to={`/login?returnTo=${encodeURIComponent(returnTo)}`}>Back to login</Link>
              </Button>
              <Button type="submit" className="rounded-full bg-green-700 hover:bg-green-800" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Send reset link
              </Button>
            </div>
          </form>
        )}
      </section>
    </PageShell>
  );
};

export default ForgotPasswordPage;
