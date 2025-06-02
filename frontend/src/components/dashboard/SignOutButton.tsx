'use client';

import { signOut } from '@/lib/auth-client';
import { Button } from '@/components/ui/Button';
import { useRouter } from 'next/navigation';

export function SignOutButton() {
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  return (
    <Button onClick={handleSignOut} variant='outline'>
      Sign Out
    </Button>
  );
}
