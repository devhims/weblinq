import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { config } from '@/config/env';
import { auth } from '@/lib/auth';
import { shouldUseFrontendAuth } from '@/lib/utils';

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
    let session;
    const useFrontendAuth = shouldUseFrontendAuth();

    console.log('🔍 [ServerAuthGuard] Environment check:', {
      host: headersList.get('host'),
      origin: currentOrigin,
      useFrontendAuth,
    });

    if (useFrontendAuth) {
      // Preview/dev: Use frontend auth instance with host-only cookies
      session = await auth.api.getSession({
        headers: headersList,
      });

      console.log('🔍 [ServerAuthGuard] Frontend auth session:', {
        hasUser: !!session?.user,
        userId: session?.user?.id,
        email: session?.user?.email,
      });
    } else {
      // Production: Use backend auth via HTTP request
      const cookieHeader = headersList.get('cookie') || '';
      console.log('🔍 [ServerAuthGuard] Backend auth check:', {
        hasCookies: !!cookieHeader,
        cookiePreview: cookieHeader.substring(0, 100),
      });

      const response = await fetch(
        `${config.backendUrl}/api/auth/get-session`,
        {
          headers: {
            cookie: cookieHeader,
            'content-type': 'application/json',
            origin: currentOrigin,
          },
          credentials: 'include',
        },
      );

      if (!response.ok) {
        console.log(
          '🔒 [ServerAuthGuard] Backend response not OK:',
          response.status,
        );
        redirect(finalRedirectTo);
      }

      session = await response.json();
      console.log('🔍 [ServerAuthGuard] Backend auth session:', {
        hasUser: !!session?.user,
        userId: session?.user?.id,
        email: session?.user?.email,
      });
    }

    if (!session?.user) {
      console.log(
        '🔒 [ServerAuthGuard] No user in session, redirecting to:',
        finalRedirectTo,
      );
      redirect(finalRedirectTo);
    }

    console.log('✅ [ServerAuthGuard] Authentication successful');
  } catch (error) {
    console.error('❌ [ServerAuthGuard] Error:', error);
    redirect(finalRedirectTo);
  }

  return <>{children}</>;
}
