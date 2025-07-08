import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { config } from '@/config/env';

interface ServerAuthGuardProps {
  children: React.ReactNode;
  redirectTo?: string;
}

export async function ServerAuthGuard({
  children,
  redirectTo = `${config.frontendUrl}/sign-in`,
}: ServerAuthGuardProps) {
  try {
    const headersList = await headers();

    const response = await fetch(`${config.backendUrl}/api/auth/get-session`, {
      headers: {
        cookie: headersList.get('cookie') || '',
        'content-type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      redirect(redirectTo);
    }

    const session = await response.json();

    if (!session?.user) {
      redirect(redirectTo);
    }
  } catch (error) {
    console.error('ServerAuthGuard error:', error);
    redirect(redirectTo);
  }

  return <>{children}</>;
}
