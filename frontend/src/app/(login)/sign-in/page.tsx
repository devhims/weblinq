'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth-client';
import UnifiedAuthForm from '@/components/auth/unified-auth-form';

export default function SignInPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  useEffect(() => {
    // Redirect authenticated users to dashboard
    if (!isPending && session?.user) {
      router.replace('/dashboard');
    }
  }, [session, isPending, router]);

  // Show nothing while checking auth status or if user is authenticated
  if (isPending || session?.user) {
    return null;
  }

  return <UnifiedAuthForm />;
}
