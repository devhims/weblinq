'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useActionState } from 'react';
import { toast } from 'sonner';
import { sendEmailVerification, verifyEmail } from '@/server/auth-actions';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';
  const token = searchParams.get('token');
  const resent = searchParams.get('resent') === 'true';
  const error = searchParams.get('error');

  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(60); // Start with 60 seconds for new signups

  // Email verification state
  const emailVerificationInitialState = {
    errorMessage: null,
    successMessage: null,
    email: '',
  };
  const [
    emailVerificationState,
    emailVerificationAction,
    emailVerificationPending,
  ] = useActionState(sendEmailVerification, emailVerificationInitialState);

  // Token verification state
  const verifyTokenInitialState = { errorMessage: '' };
  const [verifyTokenState, verifyTokenAction, verifyTokenPending] =
    useActionState(verifyEmail, verifyTokenInitialState);

  // Auto-verify if token is present in URL
  useEffect(() => {
    if (token) {
      const formData = new FormData();
      formData.set('token', token);
      verifyTokenAction(formData);
    }
  }, [token, verifyTokenAction]);

  // Handle countdown for resend button
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Handle email verification response
  useEffect(() => {
    if (emailVerificationState.errorMessage) {
      toast.error(emailVerificationState.errorMessage, {
        style: {
          background: '#fee2e2',
          border: '1px solid #fecaca',
          color: '#991b1b',
        },
      });
    } else if (emailVerificationState.successMessage) {
      toast.success(emailVerificationState.successMessage, {
        style: {
          background: '#dcfce7',
          border: '1px solid #bbf7d0',
          color: '#166534',
        },
      });
      setCountdown(60); // Start 60-second countdown
    }
  }, [emailVerificationState]);

  // Handle token verification response
  useEffect(() => {
    if (verifyTokenState.errorMessage) {
      toast.error(verifyTokenState.errorMessage, {
        style: {
          background: '#fee2e2',
          border: '1px solid #fecaca',
          color: '#991b1b',
        },
      });
    }
  }, [verifyTokenState.errorMessage]);

  const handleResendEmail = async () => {
    if (countdown > 0 || !email) return;

    setIsResending(true);
    const formData = new FormData();
    formData.set('email', email);
    await emailVerificationAction(formData);
    setIsResending(false);
  };

  // If we're verifying a token, show loading state
  if (token && verifyTokenPending) {
    return (
      <div className='w-full max-w-md mx-auto'>
        <div className='mb-8 text-center'>
          <Link href='/' aria-label='go home' className='inline-block mb-6'>
            <Icons.logo className='h-8 w-auto' />
          </Link>
          <h1 className='text-3xl font-bold text-foreground mb-2'>
            Verifying Email...
          </h1>
          <p className='text-muted-foreground'>
            Please wait while we verify your email address.
          </p>
        </div>

        <div className='flex justify-center'>
          <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary'></div>
        </div>
      </div>
    );
  }

  return (
    <div className='w-full max-w-md mx-auto'>
      {/* Header */}
      <div className='mb-8 text-center'>
        <Link href='/' aria-label='go home' className='inline-block mb-6'>
          <Icons.logo className='h-8 w-auto' />
        </Link>
        <h1 className='text-3xl font-bold text-foreground mb-2'>
          Check Your Email
        </h1>
        <p className='text-muted-foreground'>
          {error === 'verification-failed'
            ? 'Email verification failed. Please try again or request a new verification email.'
            : resent
            ? "We've resent the verification link to your email address"
            : "We've sent a verification link to your email address"}
        </p>
      </div>

      {/* Email display */}
      {email && (
        <div className='mb-6 p-4 bg-muted rounded-lg text-center'>
          <div className='flex items-center justify-center space-x-2 mb-2'>
            <Icons.mail className='h-5 w-5 text-muted-foreground' />
            <span className='font-medium'>{email}</span>
          </div>
          <p className='text-sm text-muted-foreground'>
            Click the verification link in the email to activate your account
          </p>
        </div>
      )}

      {/* Instructions */}
      <div className='mb-6 space-y-4'>
        <div className='bg-blue-50 border border-blue-200 rounded-lg p-4'>
          <h3 className='font-semibold text-blue-900 mb-2'>Next Steps:</h3>
          <ol className='text-sm text-blue-800 space-y-1 list-decimal list-inside'>
            <li>Check your email inbox for a verification message</li>
            <li>Click the verification link in the email</li>
            <li>You&apos;ll be automatically signed in and redirected</li>
          </ol>
        </div>

        <div className='bg-yellow-50 border border-yellow-200 rounded-lg p-4'>
          <p className='text-sm text-yellow-800'>
            <strong>Don&apos;t see the email?</strong> Check your spam folder or
            click the resend button below.
          </p>
        </div>
      </div>

      {/* Resend button */}
      {email && (
        <div className='mb-6 text-center'>
          <Button
            variant='outline'
            onClick={handleResendEmail}
            disabled={countdown > 0 || isResending || emailVerificationPending}
            className='w-full'
          >
            {isResending || emailVerificationPending
              ? 'Sending...'
              : countdown > 0
              ? `Resend in ${countdown}s`
              : 'Resend Verification Email'}
          </Button>
        </div>
      )}

      {/* Footer links */}
      <div className='mt-6 text-center'>
        <p className='text-sm text-muted-foreground mt-2'>
          Already verified?{' '}
          <Link href='/sign-in' className='text-primary hover:underline'>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className='w-full max-w-md mx-auto'>
          <div className='mb-8 text-center'>
            <Icons.logo className='h-8 w-auto mx-auto mb-6' />
            <h1 className='text-3xl font-bold text-foreground mb-2'>
              Loading...
            </h1>
          </div>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
