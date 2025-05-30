'use client';

import { useSession, signOut } from '@/lib/auth-client';
import { Button } from '@/components/ui/Button';

export function UserProfile() {
  const { data: session, isPending, error } = useSession();

  if (isPending) {
    return <div className='p-4'>Loading...</div>;
  }

  if (error) {
    return <div className='p-4'>Error: {error.message}</div>;
  }

  if (!session?.user) {
    return <div className='p-4'>Not authenticated</div>;
  }

  const handleSignOut = async () => {
    await signOut({
      fetchOptions: {
        onSuccess: () => {
          // Optionally redirect or show success message
          window.location.href = '/login';
        },
      },
    });
  };

  return (
    <div className='p-4 border rounded-lg'>
      <div className='flex items-center gap-4'>
        {session.user.image && (
          <img
            src={session.user.image}
            alt={session.user.name || 'User'}
            className='w-12 h-12 rounded-full'
          />
        )}
        <div>
          <h3 className='font-semibold'>{session.user.name || 'User'}</h3>
          <p className='text-gray-600'>{session.user.email}</p>
          <p className='text-xs text-gray-500'>
            {session.user.emailVerified
              ? '✅ Email verified'
              : '⚠️ Email not verified'}
          </p>
        </div>
      </div>
      <Button onClick={handleSignOut} variant='outline' className='mt-4'>
        Sign Out
      </Button>
    </div>
  );
}
