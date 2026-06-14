import { useCallback, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Loader2, LockKeyhole } from 'lucide-react';

import authService from '../services/authService';
import { showError, showSuccess } from '../utils/toast';
import { Breadcrumbs, PageShell } from '../components/storefront/StorefrontLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';
  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const returnTo = useMemo(() => {
    const requested = searchParams.get('returnTo') || location.state?.returnTo || '';
    return requested.startsWith('/') && !requested.startsWith('//') ? requested : '/';
  }, [location.state?.returnTo, searchParams]);

  const handleSubmit = useCallback(async (event) => {
    event.preventDefault();
    if (!token) {
      showError('Invalid reset link. Please request a new password reset.');
      return;
    }
    if (form.password.length < 8) {
      showError('Password must be at least 8 characters.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      showError("Passwords don't match.");
      return;
    }

    setIsSubmitting(true);
    try {
      await authService.resetPassword(token, form.password);
      showSuccess('Password has been reset. You can now sign in.');
      navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`, { replace: true });
    } catch (error) {
      showError(error, 'Could not reset password. The link may have expired.');
    } finally {
      setIsSubmitting(false);
    }
  }, [form.confirmPassword, form.password, navigate, returnTo, token]);

  return (
    <PageShell activePath="/login">
      <Breadcrumbs items={[{ label: 'Reset password' }]} />
      <section className="mx-auto max-w-xl rounded-2xl border border-green-200 bg-white p-6 sm:rounded-[2rem] md:p-8">
        {!token ? (
          <div className="text-center">
            <h1 className="text-3xl font-black text-slate-950">Invalid reset link</h1>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-500">
              This password reset link is missing or invalid. Request a new one to continue.
            </p>
            <Button asChild className="mt-6 rounded-full bg-green-700 hover:bg-green-800">
              <Link to={`/forgot-password?returnTo=${encodeURIComponent(returnTo)}`}>Request new link</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-green-200 bg-green-50 text-green-800">
              <LockKeyhole className="h-7 w-7" />
            </span>
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-green-700">Secure reset</p>
              <h1 className="mt-2 text-3xl font-black text-slate-950">Set a new password</h1>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                Choose a new password for your Sabito Store shopper account.
              </p>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-semibold text-slate-700" htmlFor="password">New password</label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-900"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-semibold text-slate-700" htmlFor="confirmPassword">Confirm password</label>
              <Input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                value={form.confirmPassword}
                onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button asChild type="button" variant="outline" className="rounded-full border-green-200 text-green-800 hover:bg-green-50">
                <Link to={`/login?returnTo=${encodeURIComponent(returnTo)}`}>Back to login</Link>
              </Button>
              <Button type="submit" className="rounded-full bg-green-700 hover:bg-green-800" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Reset password
              </Button>
            </div>
          </form>
        )}
      </section>
    </PageShell>
  );
};

export default ResetPasswordPage;
