'use client';

import { useSession, signOut } from '@/lib/auth-client';
import { Button } from '@/components/ui/Button';
import { ApiKeyManager } from '@/components/dashboard/ApiKeyManager';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function DashboardPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isPending && !session) {
      console.log('No user found, redirecting to login...');
      setTimeout(() => {
        router.push('/');
      }, 1000);
    }
  }, [session, isPending, router]);

  if (isPending) {
    return (
      <div className='min-h-screen bg-gray-50 flex justify-center items-center'>
        <div className='text-lg text-gray-700'>Checking authentication...</div>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className='min-h-screen bg-gray-50 flex justify-center items-center'>
        <div className='text-lg text-gray-700'>
          No user found, waiting a bit before redirect...
        </div>
      </div>
    );
  }

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  return (
    <div className='min-h-screen bg-gray-50'>
      <div className='container mx-auto px-4 py-8 max-w-7xl'>
        <div className='flex justify-between items-center mb-8'>
          <div>
            <h1 className='text-3xl font-bold text-gray-900'>Dashboard</h1>
            <p className='text-gray-600 mt-2'>
              Welcome back, {session.user.name || session.user.email}!
            </p>
          </div>
          <Button onClick={handleSignOut} variant='outline'>
            Sign Out
          </Button>
        </div>

        <div className='grid gap-6'>
          <div className='bg-white p-6 rounded-lg shadow-sm border border-gray-200'>
            <h2 className='text-xl font-semibold mb-4 text-gray-900'>
              Account Information
            </h2>
            <div className='space-y-3'>
              <p className='text-sm'>
                <span className='font-medium text-gray-700'>Email:</span>
                <span className='text-gray-600 ml-2'>{session.user.email}</span>
              </p>
              {session.user.name && (
                <p className='text-sm'>
                  <span className='font-medium text-gray-700'>Name:</span>
                  <span className='text-gray-600 ml-2'>
                    {session.user.name}
                  </span>
                </p>
              )}
              <p className='text-sm'>
                <span className='font-medium text-gray-700'>User ID:</span>
                <span className='text-gray-600 ml-2 font-mono text-xs'>
                  {session.user.id}
                </span>
              </p>
            </div>
          </div>

          <ApiKeyManager />
        </div>
      </div>
    </div>
  );
}
