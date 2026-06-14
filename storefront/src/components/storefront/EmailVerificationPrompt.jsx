import { useCallback, useState } from 'react';
import { Loader2, MailCheck } from 'lucide-react';

import { useStorefrontAuth } from '../../context/StorefrontAuthContext';
import { showError, showSuccess } from '../../utils/toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const EmailVerificationPrompt = () => {
  const { customer, resendVerification, verifyEmail } = useStorefrontAuth();
  const [otp, setOtp] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const email = customer?.email || '';
  const isVerified = customer?.isEmailVerified === true || Boolean(customer?.emailVerifiedAt);

  const handleResend = useCallback(async () => {
    setIsResending(true);
    try {
      await resendVerification({ email });
      showSuccess('A new verification code has been sent.');
    } catch (error) {
      showError(error, 'Could not send a new verification code.');
    } finally {
      setIsResending(false);
    }
  }, [email, resendVerification]);

  const handleVerify = useCallback(async (event) => {
    event.preventDefault();
    setIsVerifying(true);
    try {
      await verifyEmail({ email, otp });
      setOtp('');
      showSuccess('Email verified successfully.');
    } catch (error) {
      showError(error, 'Could not verify your email.');
    } finally {
      setIsVerifying(false);
    }
  }, [email, otp, verifyEmail]);

  if (!customer || isVerified) return null;

  return (
    <form onSubmit={handleVerify} className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:mb-6 sm:rounded-[2rem] sm:p-5">
      <Alert className="border-amber-200 bg-white">
        <MailCheck className="h-4 w-4" />
        <AlertDescription>
          Verify {email} to keep your shopper account trusted. You can continue using your account while verification is pending.
        </AlertDescription>
      </Alert>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end">
        <div className="grid gap-2">
          <label className="text-sm font-semibold text-slate-700" htmlFor="account-email-verification-code">
            6-digit verification code
          </label>
          <Input
            id="account-email-verification-code"
            inputMode="numeric"
            maxLength={6}
            pattern="[0-9]{6}"
            value={otp}
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
            autoComplete="one-time-code"
            placeholder="123456"
            required
          />
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full rounded-full border-amber-300 bg-white text-amber-900 hover:bg-amber-100 md:w-auto"
          disabled={isResending || !email}
          onClick={handleResend}
        >
          {isResending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Resend code
        </Button>
        <Button
          type="submit"
          className="w-full rounded-full bg-green-700 hover:bg-green-800 md:w-auto"
          disabled={isVerifying || otp.length !== 6}
        >
          {isVerifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Verify email
        </Button>
      </div>
    </form>
  );
};

export default EmailVerificationPrompt;
