import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import authService from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { showSuccess, showError } from '../utils/toast';
import { Button } from '@/components/ui/button';

/**
 * Page reached when user clicks the verification link in email.
 * Calls GET /auth/verify-email?token=... and shows success or error.
 */
const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshAuthState, user } = useAuth();
  const token = searchParams.get('token');
  const [status, setStatus] = useState('loading'); // 'loading' | 'success' | 'error'
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Invalid or missing verification link.');
      return;
    }

    let cancelled = false;
    authService
      .verifyEmail(token)
      .then((res) => {
        if (cancelled) return;
        const msg = res?.data?.message || 'Email verified successfully.';
        setStatus('success');
        setMessage(msg);
        showSuccess(msg);
        refreshAuthState().catch(() => {});
        setTimeout(() => navigate('/dashboard', { replace: true }), 2000);
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = err?.response?.data?.message || 'Invalid or expired link. Please request a new verification email.';
        setStatus('error');
        setMessage(msg);
        showError(err, msg);
      });

    return () => { cancelled = true; };
  }, [token, navigate, refreshAuthState]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-md text-center">
          <h1 className="text-3xl font-bold text-[#166534] mb-4">ShopWISE</h1>
          <Loader2 className="h-12 w-12 animate-spin text-[#166534] mx-auto mb-4" />
          <p className="text-muted-foreground">Verifying your email...</p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-md text-center">
          <h1 className="text-3xl font-bold text-[#166534] mb-4">ShopWISE</h1>
          <CheckCircle className="h-16 w-16 text-[#166534] mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">Email verified</h2>
          <p className="text-muted-foreground mb-6">{message}</p>
          <Button
            onClick={() => navigate('/dashboard', { replace: true })}
            className="bg-[#166534] hover:bg-[#14532d] text-white"
          >
            Go to dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <h1 className="text-3xl font-bold text-[#166534] mb-4">ShopWISE</h1>
        <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">Verification failed</h2>
        <p className="text-muted-foreground mb-6">{message}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {user ? (
            <Button variant="outline" asChild>
              <Link to="/dashboard">Go to dashboard</Link>
            </Button>
          ) : (
            <Button variant="outline" asChild>
              <Link to="/login">Sign in</Link>
            </Button>
          )}
          {user && (
            <Button asChild>
              <Link to="/dashboard">Resend from dashboard</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
