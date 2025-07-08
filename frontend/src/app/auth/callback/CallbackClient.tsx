'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { authClient } from '@/lib/auth-client';

export const dynamic = 'force-dynamic';

export default function CallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const token = searchParams.get('token');
        const verified = searchParams.get('verified') === 'true';
        const newUser = searchParams.get('new_user') === 'true';

        console.log('Auth callback processing:', { token, verified, newUser });

        if (token && verified) {
          // Verify the token on the frontend to establish the session
          console.log('Verifying token and establishing session...');

          // Use Better Auth client to verify the token and establish the session
          try {
            await authClient.verifyEmail({
              query: { token },
            });

            console.log('Email verification successful via authClient');

            // Wait a moment for session to be established
            await new Promise((resolve) => setTimeout(resolve, 500));

            // Session should now be established, redirect to dashboard
            const dashboardPath = newUser
              ? '/dashboard?new_user=true&verified=true'
              : '/dashboard?verified=true';
            console.log(
              'Verification successful, redirecting to:',
              dashboardPath,
            );
            router.replace(dashboardPath);
          } catch (verifyError) {
            console.error('Better Auth verification failed:', verifyError);
            throw new Error('Email verification failed');
          }
        } else {
          // No token or verification failed
          throw new Error('Invalid verification parameters');
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        setError(
          error instanceof Error ? error.message : 'Verification failed',
        );
        setIsProcessing(false);

        // Redirect to sign-in with error after a delay
        setTimeout(() => {
          router.replace('/sign-in?error=verification-failed');
        }, 3000);
      }
    };

    handleCallback();
  }, [router, searchParams]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">
            Verification Failed
          </h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <p className="text-sm text-gray-500">
            Redirecting to sign-in page...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="max-w-md text-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Verifying Your Email
        </h1>
        <p className="text-gray-600">
          Please wait while we complete your verification...
        </p>
      </div>
    </div>
  );
}
