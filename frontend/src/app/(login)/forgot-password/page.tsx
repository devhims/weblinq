'use client';

import { useActionState, useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { forgotPassword } from '@/server/auth-actions';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

function ForgotPasswordContent() {
  const searchParams = useSearchParams();
  const emailParam = searchParams.get('email') || '';

  const [countdown, setCountdown] = useState(0);
  const [emailSent, setEmailSent] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  const initialState = { errorMessage: null, successMessage: null };
  const [state, formAction, pending] = useActionState(
    forgotPassword,
    initialState
  );

  // Handle countdown for resend button
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Handle form response
  useEffect(() => {
    if (state.errorMessage) {
      toast.error(state.errorMessage, {
        style: {
          background: '#fee2e2',
          border: '1px solid #fecaca',
          color: '#991b1b',
        },
      });
    } else if (state.successMessage) {
      toast.success(state.successMessage, {
        style: {
          background: '#dcfce7',
          border: '1px solid #bbf7d0',
          color: '#166534',
        },
      });
      setEmailSent(true);
      setCountdown(60); // Start 60-second countdown
    }
  }, [state]);

  const handleFormSubmit = (formData: FormData) => {
    const email = formData.get('email') as string;
    setSubmittedEmail(email);
    formAction(formData);
  };

  return (
    <div className='w-full max-w-md mx-auto'>
      {/* Header */}
      <div className='mb-8 text-center'>
        <Link href='/' aria-label='go home' className='inline-block mb-6'>
          <Icons.logo className='h-8 w-auto' />
        </Link>
        <h1 className='text-3xl font-bold text-foreground mb-2'>
          {emailSent ? 'Check Your Email' : 'Forgot Password?'}
        </h1>
        <p className='text-muted-foreground'>
          {emailSent
            ? `We've sent a password reset link to ${
                submittedEmail || 'your email address'
              }`
            : "Enter your email address and we'll send you a reset link"}
        </p>
      </div>

      {emailSent ? (
        // Success state - email sent
        <div className='space-y-6'>
          <div className='bg-green-50 border border-green-200 rounded-lg p-4'>
            <div className='flex items-center space-x-2 mb-2'>
              <Icons.mail className='h-5 w-5 text-green-600' />
              <h3 className='font-semibold text-green-900'>Email Sent!</h3>
            </div>
            <p className='text-sm text-green-800'>
              Check your email inbox for a password reset link. Click the link
              to create a new password, then sign in with your new password.
            </p>
          </div>

          <div className='bg-blue-50 border border-blue-200 rounded-lg p-4'>
            <h3 className='font-semibold text-blue-900 mb-2'>Email sent to:</h3>
            <p className='font-mono text-sm text-blue-800 bg-white px-3 py-2 rounded border'>
              {submittedEmail}
            </p>
          </div>

          <div className='bg-yellow-50 border border-yellow-200 rounded-lg p-4'>
            <p className='text-sm text-yellow-800'>
              <strong>Don&apos;t see the email?</strong> Check your spam folder
              or wait a moment before requesting another reset.
            </p>
          </div>

          <form action={handleFormSubmit} className='space-y-4'>
            <input type='hidden' name='email' value={submittedEmail} />
            <Button className='w-full h-11' disabled={pending || countdown > 0}>
              {pending
                ? 'Sending...'
                : countdown > 0
                ? `Resend in ${countdown}s`
                : 'Send Another Reset Link'}
            </Button>
          </form>
        </div>
      ) : (
        // Initial state - request password reset
        <form action={handleFormSubmit} className='space-y-6'>
          <div className='space-y-2'>
            <Label htmlFor='email' className='text-sm font-medium'>
              Email Address
            </Label>
            <Input
              type='email'
              required
              name='email'
              id='email'
              placeholder='Enter your email address'
              className='h-11'
              disabled={pending}
              defaultValue={emailParam}
            />
          </div>

          <Button className='w-full h-11' disabled={pending}>
            {pending ? 'Sending Reset Link...' : 'Send Reset Link'}
          </Button>
        </form>
      )}

      {/* Instructions */}
      <div className='mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4'>
        <h3 className='font-semibold text-blue-900 mb-2'>How it works:</h3>
        <ol className='text-sm text-blue-800 space-y-1 list-decimal list-inside'>
          <li>Enter your email address above</li>
          <li>Check your email for a reset link</li>
          <li>Click the link to create a new password</li>
          <li>Sign in with your new password</li>
        </ol>
      </div>

      {/* Footer links */}
      <div className='mt-6 text-center space-y-2'>
        {/* <p className='text-sm text-muted-foreground'>
          Remember your password?{' '}
          <Link href='/sign-in' className='text-primary hover:underline'>
            Sign in
          </Link>
        </p> */}
        <p className='text-sm text-muted-foreground'>
          Don&apos;t have an account?{' '}
          <Link href='/sign-in' className='text-primary hover:underline'>
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
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
      <ForgotPasswordContent />
    </Suspense>
  );
}
