import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

interface ServerAuthGuardProps {
  children: React.ReactNode;
  redirectTo?: string;
}

export async function ServerAuthGuard({ children, redirectTo = '/sign-in' }: ServerAuthGuardProps) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect(redirectTo);
  }

  return <>{children}</>;
}
