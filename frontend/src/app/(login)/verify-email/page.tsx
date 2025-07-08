'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = searchParams.get('email') || '';
  const token = searchParams.get('token');
  const resent = searchParams.get('resent') === 'true';
  const error = searchParams.get('error');

  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(60); // Start with 60 seconds for new signups

  // Auto-redirect to API verification route if token is present in URL
  useEffect(() => {
    if (token) {
      // Redirect to our API route for verification
      router.push(`/api/verify?token=${token}`);
    }
  }, [token, router]);

  // Handle countdown for resend button
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleResendEmail = async () => {
    if (countdown > 0 || !email || isResending) return;

    setIsResending(true);
    try {
      // Use Better Auth client to resend verification email
      const { error } = await authClient.sendVerificationEmail({
        email,
        callbackURL: `${process.env.NEXT_PUBLIC_FRONTEND_URL}/dashboard`,
      });

      if (error) {
        toast.error(error.message || 'Failed to resend verification email', {
          style: {
            background: '#fee2e2',
            border: '1px solid #fecaca',
            color: '#991b1b',
          },
        });
      } else {
        toast.success('Verification email sent! Please check your inbox.', {
          style: {
            background: '#dcfce7',
            border: '1px solid #bbf7d0',
            color: '#166534',
          },
        });
        setCountdown(60); // Start 60-second countdown
      }
    } catch (err) {
      toast.error('Failed to resend email. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  // If we're redirecting to verify a token, show loading state
  if (token) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="mb-8 text-center">
          <Link href="/" aria-label="go home" className="inline-block mb-6">
            <Icons.logo className="h-8 w-auto" />
          </Link>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Verifying Email...
          </h1>
          <p className="text-muted-foreground">
            Please wait while we verify your email address.
          </p>
        </div>

        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Header */}
      <div className="mb-8 text-center">
        <Link href="/" aria-label="go home" className="inline-block mb-6">
          <Icons.logo className="h-8 w-auto" />
        </Link>
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Check Your Email
        </h1>
        <p className="text-muted-foreground">
          {error === 'verification-failed'
            ? 'Email verification failed. Please try again or request a new verification email.'
            : resent
              ? "We've resent the verification link to your email address"
              : "We've sent a verification link to your email address"}
        </p>
      </div>

      {/* Email display */}
      {email && (
        <div className="mb-6 p-4 bg-muted rounded-lg text-center">
          <div className="flex items-center justify-center space-x-2 mb-2">
            <Icons.mail className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">{email}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Click the verification link in the email to activate your account
          </p>
        </div>
      )}

      {/* Instructions */}
      <div className="mb-6 space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">Next Steps:</h3>
          <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
            <li>Check your email inbox for a verification message</li>
            <li>Click the verification link in the email</li>
            <li>You&apos;ll be automatically signed in and redirected</li>
          </ol>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            <strong>Don&apos;t see the email?</strong> Check your spam folder or
            click the resend button below.
          </p>
        </div>
      </div>

      {/* Resend button */}
      {email && (
        <div className="mb-6 text-center">
          <Button
            variant="outline"
            onClick={handleResendEmail}
            disabled={countdown > 0 || isResending}
            className="w-full"
          >
            {isResending
              ? 'Sending...'
              : countdown > 0
                ? `Resend in ${countdown}s`
                : 'Resend Verification Email'}
          </Button>
        </div>
      )}

      {/* Footer links */}
      <div className="mt-6 text-center">
        <p className="text-sm text-muted-foreground mt-2">
          Already verified?{' '}
          <Link href="/sign-in" className="text-primary hover:underline">
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
        <div className="w-full max-w-md mx-auto">
          <div className="mb-8 text-center">
            <Icons.logo className="h-8 w-auto mx-auto mb-6" />
            <h1 className="text-3xl font-bold text-foreground mb-2">
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
