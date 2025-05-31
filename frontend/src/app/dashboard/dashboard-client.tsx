'use client';

import { signOut } from '@/lib/auth-client';
import { Button } from '@/components/ui/Button';
import { useRouter } from 'next/navigation';

interface Session {
  user: {
    id: string;
    email: string;
    name?: string;
    emailVerified: boolean;
    [key: string]: unknown;
  };
  session: {
    id: string;
    [key: string]: unknown;
  };
}

interface DashboardClientProps {
  initialSession: Session;
}

export default function DashboardClient({
  initialSession,
}: DashboardClientProps) {
  const router = useRouter();
  const user = initialSession.user;

  const handleSignOut = async () => {
    await signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push('/login');
        },
      },
    });
  };

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

              {/* Debug info to verify session data */}
              <div className='mt-6 bg-blue-50 rounded-lg p-4 max-w-md mx-auto'>
                <h4 className='text-sm font-semibold text-blue-900 mb-2'>
                  Session Status
                </h4>
                <p className='text-xs text-blue-700'>
                  ✅ Session loaded from backend directly
                </p>
                <p className='text-xs text-blue-700'>
                  Session ID: {initialSession.session?.id}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
