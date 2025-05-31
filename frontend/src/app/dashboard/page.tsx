'use client';

import { useSession, signOut, getSession } from '@/lib/auth-client';
import { Button } from '@/components/ui/Button';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';

function DashboardContent() {
  const { data: session, isPending, error } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [redirectDelay, setRedirectDelay] = useState(1000);
  const [retryCount, setRetryCount] = useState(0);

  // If this is an OAuth success, give more time for session to establish
  useEffect(() => {
    const isOAuthSuccess = searchParams.get('oauth') === 'success';
    if (isOAuthSuccess) {
      console.log('OAuth success detected, extending session load time');
      setRedirectDelay(3000); // 3 seconds for OAuth flows

      // Manually refresh session after OAuth
      const refreshSession = async () => {
        try {
          console.log('Manually refreshing session after OAuth...');
          await getSession();
        } catch (err) {
          console.error('Failed to refresh session:', err);
        }
      };

      refreshSession();
    }
  }, [searchParams]);

  console.log('Dashboard render:', {
    session,
    isPending,
    error,
    redirectDelay,
    retryCount,
  });

  // Handle redirect to login if not authenticated
  useEffect(() => {
    console.log('Dashboard effect:', { isPending, user: session?.user });
    if (!isPending && !session?.user) {
      console.log(
        `No user found, waiting ${redirectDelay}ms before redirect...`
      );

      // For OAuth flows, try refreshing session a few times before giving up
      const isOAuthSuccess = searchParams.get('oauth') === 'success';
      if (isOAuthSuccess && retryCount < 3) {
        const timeout = setTimeout(async () => {
          console.log(`Retry ${retryCount + 1}: Refreshing session...`);
          setRetryCount((prev) => prev + 1);
          try {
            await getSession();
          } catch (err) {
            console.error('Session refresh failed:', err);
          }
        }, 1000);

        return () => clearTimeout(timeout);
      }

      // Final redirect after retries or non-OAuth flows
      const timeout = setTimeout(() => {
        console.log('Redirecting to login - no user after timeout');
        router.push('/login');
      }, redirectDelay);

      return () => clearTimeout(timeout);
    }
  }, [
    session?.user,
    isPending,
    router,
    redirectDelay,
    searchParams,
    retryCount,
  ]);

  const handleSignOut = async () => {
    await signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push('/login');
        },
      },
    });
  };

  if (isPending) {
    return (
      <div className='min-h-screen flex items-center justify-center'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto'></div>
          <p className='mt-4 text-gray-600'>Loading your session...</p>
          {searchParams.get('oauth') === 'success' && (
            <p className='mt-2 text-sm text-blue-600'>
              Completing GitHub authentication...
            </p>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='min-h-screen flex items-center justify-center'>
        <div className='text-red-600'>Error: {error.message}</div>
      </div>
    );
  }

  // Show loading state while redirecting
  if (!session?.user) {
    return (
      <div className='min-h-screen flex items-center justify-center'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto'></div>
          <p className='mt-4 text-gray-600'>Completing authentication...</p>
          {retryCount > 0 && (
            <p className='mt-2 text-sm text-gray-500'>
              Retry attempt {retryCount}...
            </p>
          )}
        </div>
      </div>
    );
  }

  const user = session.user;

  return (
    <div className='min-h-screen bg-gray-50'>
      <div className='bg-white shadow'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='flex justify-between items-center py-6'>
            <h1 className='text-2xl font-bold text-gray-900'>Dashboard</h1>
            <div className='flex items-center space-x-4'>
              <span className='text-gray-700'>
                Welcome, {user.name || user.email}!
              </span>
              <Button variant='outline' onClick={handleSignOut}>
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className='max-w-7xl mx-auto py-6 sm:px-6 lg:px-8'>
        <div className='px-4 py-6 sm:px-0'>
          <div className='border-4 border-dashed border-gray-200 rounded-lg h-96 p-8'>
            <div className='text-center'>
              <h2 className='text-3xl font-bold text-gray-900 mb-4'>
                🎉 Welcome to your Dashboard!
              </h2>
              <p className='text-gray-600 mb-6'>
                You have successfully signed in to your account.
              </p>

              <div className='bg-white rounded-lg shadow p-6 max-w-md mx-auto'>
                <h3 className='text-lg font-semibold mb-4'>
                  Your Account Info
                </h3>
                <div className='space-y-2 text-left'>
                  <p>
                    <strong>Email:</strong> {user.email}
                  </p>
                  {user.name && (
                    <p>
                      <strong>Name:</strong> {user.name}
                    </p>
                  )}
                  <p>
                    <strong>User ID:</strong> {user.id}
                  </p>
                  <p>
                    <strong>Email Verified:</strong>{' '}
                    {user.emailVerified ? '✅ Yes' : '⚠️ No'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardFallback() {
  return (
    <div className='min-h-screen flex items-center justify-center'>
      <div className='text-center'>
        <div className='animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto'></div>
        <p className='mt-4 text-gray-600'>Loading dashboard...</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardFallback />}>
      <DashboardContent />
    </Suspense>
  );
}
