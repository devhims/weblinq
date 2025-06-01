'use client';

import { useSession, signOut } from '@/lib/auth-client';
import { Button } from '@/components/ui/Button';
import { ApiKeyManager } from '@/components/dashboard/ApiKeyManager';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function DashboardPage() {
  const { data: session, isPending, error } = useSession();
  const router = useRouter();

  console.log('Dashboard session check:', { session, isPending, error });

  // Debug: Check cookies manually
  useEffect(() => {
    if (typeof window !== 'undefined') {
      console.log('🍪 Current cookies:', document.cookie);
      console.log('🔧 Current URL:', window.location.href);
    }
  }, []);

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
      <div className='flex justify-center items-center min-h-screen'>
        <div className='text-lg'>Checking authentication...</div>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className='flex justify-center items-center min-h-screen'>
        <div className='text-lg'>
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
    <div className='container mx-auto px-4 py-8'>
      <div className='flex justify-between items-center mb-8'>
        <div>
          <h1 className='text-3xl font-bold'>Dashboard</h1>
          <p className='text-gray-600 mt-2'>
            Welcome back, {session.user.name || session.user.email}!
          </p>
        </div>
        <Button onClick={handleSignOut} variant='outline'>
          Sign Out
        </Button>
      </div>

      <div className='grid gap-6'>
        <div className='bg-white p-6 rounded-lg shadow'>
          <h2 className='text-xl font-semibold mb-4'>Account Information</h2>
          <div className='space-y-2'>
            <p>
              <span className='font-medium'>Email:</span> {session.user.email}
            </p>
            {session.user.name && (
              <p>
                <span className='font-medium'>Name:</span> {session.user.name}
              </p>
            )}
            <p>
              <span className='font-medium'>User ID:</span> {session.user.id}
            </p>
          </div>
        </div>

        <ApiKeyManager />
      </div>
    </div>
  );
}
