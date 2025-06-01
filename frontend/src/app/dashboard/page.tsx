'use client';

import { useSession, signOut } from '@/lib/auth-client';
import { Button } from '@/components/ui/Button';
import { ApiKeyManager } from '@/components/dashboard/ApiKeyManager';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { getAuthUrl } from '@/config/env';

export default function DashboardPage() {
  const { data: session, isPending, error } = useSession();
  const router = useRouter();

  console.log('Dashboard render:', { session, isPending, error });

  // Debug: Check cookies and make a manual session request
  useEffect(() => {
    console.log('🍪 Document cookies:', document.cookie);
    console.log('🔧 Auth URL for requests:', getAuthUrl());

    // Manual session check to debug the issue
    fetch(`${getAuthUrl()}/session`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    })
      .then((response) => {
        console.log(
          '🔍 Manual session check response status:',
          response.status
        );
        console.log('🔍 Response headers:', [...response.headers.entries()]);
        return response.json();
      })
      .then((data) => {
        console.log('🔍 Manual session check data:', data);
      })
      .catch((error) => {
        console.error('❌ Manual session check failed:', error);
      });
  }, []);

  // Handle redirect to login if not authenticated
  useEffect(() => {
    console.log('Dashboard effect:', { isPending, user: session?.user });
    if (!isPending && !session?.user) {
      console.log('No user found, waiting a bit before redirect...');
      // Add a small delay to give session time to load
      const timeout = setTimeout(() => {
        console.log('Redirecting to login - no user after timeout');
        router.push('/login');
      }, 1000); // 1 second delay

      return () => clearTimeout(timeout);
    }
  }, [session?.user, isPending, router]);

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
        <div className='animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600'></div>
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
        <div className='animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600'></div>
      </div>
    );
  }

  const user = session.user;

  return (
    <div className='min-h-screen bg-gray-50'>
      {/* Header */}
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

      {/* Main Content */}
      <div className='max-w-7xl mx-auto py-6 sm:px-6 lg:px-8'>
        <div className='px-4 sm:px-0'>
          <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
            {/* User Account Info */}
            <div className='lg:col-span-1'>
              <div className='bg-white rounded-lg shadow p-6'>
                <h3 className='text-lg font-semibold text-gray-900 mb-4'>
                  Account Information
                </h3>
                <div className='space-y-3'>
                  <div>
                    <span className='text-sm font-medium text-gray-500'>
                      Email
                    </span>
                    <p className='text-gray-900'>{user.email}</p>
                  </div>
                  {user.name && (
                    <div>
                      <span className='text-sm font-medium text-gray-500'>
                        Name
                      </span>
                      <p className='text-gray-900'>{user.name}</p>
                    </div>
                  )}
                  <div>
                    <span className='text-sm font-medium text-gray-500'>
                      User ID
                    </span>
                    <p className='text-gray-900 font-mono text-sm'>{user.id}</p>
                  </div>
                  <div>
                    <span className='text-sm font-medium text-gray-500'>
                      Email Verified
                    </span>
                    <p className='text-gray-900'>
                      {user.emailVerified ? (
                        <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800'>
                          ✅ Verified
                        </span>
                      ) : (
                        <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800'>
                          ⚠️ Unverified
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* API Usage Overview (placeholder for future) */}
              <div className='mt-6 bg-white rounded-lg shadow p-6'>
                <h3 className='text-lg font-semibold text-gray-900 mb-4'>
                  API Usage Overview
                </h3>
                <div className='space-y-3 text-sm text-gray-600'>
                  <p>📊 Your API usage statistics will appear here</p>
                  <p>🔄 Request monitoring coming soon</p>
                  <p>📈 Rate limit information will be displayed</p>
                </div>
              </div>
            </div>

            {/* API Key Management */}
            <div className='lg:col-span-2'>
              <ApiKeyManager />
            </div>
          </div>

          {/* Welcome Message (if no API keys exist, this could be shown) */}
          <div className='mt-8 bg-white rounded-lg shadow p-6'>
            <div className='text-center'>
              <h2 className='text-2xl font-bold text-gray-900 mb-4'>
                🎉 Welcome to your Dashboard!
              </h2>
              <p className='text-gray-600 mb-6 max-w-2xl mx-auto'>
                You have successfully signed in to your account. Use the API key
                management section above to create and manage your API keys.
                These keys will allow you to access our API programmatically.
              </p>
              <div className='grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto'>
                <div className='text-center p-4 bg-blue-50 rounded-lg'>
                  <div className='text-2xl mb-2'>🔑</div>
                  <h3 className='font-semibold text-blue-900'>
                    Create API Keys
                  </h3>
                  <p className='text-sm text-blue-700'>
                    Generate secure API keys for your applications
                  </p>
                </div>
                <div className='text-center p-4 bg-green-50 rounded-lg'>
                  <div className='text-2xl mb-2'>📊</div>
                  <h3 className='font-semibold text-green-900'>
                    Monitor Usage
                  </h3>
                  <p className='text-sm text-green-700'>
                    Track your API requests and rate limits
                  </p>
                </div>
                <div className='text-center p-4 bg-purple-50 rounded-lg'>
                  <div className='text-2xl mb-2'>⚡</div>
                  <h3 className='font-semibold text-purple-900'>
                    Fast & Secure
                  </h3>
                  <p className='text-sm text-purple-700'>
                    Built with security and performance in mind
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
