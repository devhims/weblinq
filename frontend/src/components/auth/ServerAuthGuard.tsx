import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { config } from '@/config/env';

interface ServerAuthGuardProps {
  children: React.ReactNode;
  redirectTo?: string;
}

// Helper function to get the current request's origin for server-side redirects
function getCurrentRequestOrigin(headersList: Headers): string {
  // Try to get the origin from various headers
  const host = headersList.get('host');
  const proto = headersList.get('x-forwarded-proto') || 'https';

  if (host) {
    return `${proto}://${host}`;
  }

  // Fallback to config if we can't determine the origin
  return config.frontendUrl;
}

export async function ServerAuthGuard({
  children,
  redirectTo,
}: ServerAuthGuardProps) {
  const headersList = await headers();

  // Dynamically determine redirectTo if not provided
  const currentOrigin = getCurrentRequestOrigin(headersList);
  const finalRedirectTo = redirectTo || `${currentOrigin}/sign-in`;

  try {
    const response = await fetch(`${config.backendUrl}/api/auth/get-session`, {
      headers: {
        cookie: headersList.get('cookie') || '',
        'content-type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      redirect(finalRedirectTo);
    }

    const session = await response.json();

    if (!session?.user) {
      redirect(finalRedirectTo);
    }
  } catch (error) {
    console.error('ServerAuthGuard error:', error);
    redirect(finalRedirectTo);
  }

  return <>{children}</>;
}
