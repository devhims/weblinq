import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { shouldUseFrontendAuth } from '@/lib/utils';
import { config } from '@/config/env';
import UnifiedAuthForm from '@/components/auth/unified-auth-form';

async function getSession() {
  const headersList = await headers();

  if (shouldUseFrontendAuth()) {
    // Preview/dev: Use frontend auth
    return await auth.api.getSession({ headers: headersList });
  } else {
    // Production: Use backend auth (same logic as ServerAuthGuard)
    const cookieHeader = headersList.get('cookie') || '';
    const host = headersList.get('host');
    const proto = headersList.get('x-forwarded-proto') || 'https';
    const currentOrigin = host ? `${proto}://${host}` : config.frontendUrl;

    try {
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

      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.log('Backend auth check failed:', error);
    }

    return null;
  }
}

export default async function SignInPage() {
  // If user is already authenticated, redirect to dashboard
  const session = await getSession();

  if (session?.user) {
    redirect('/dashboard');
  }

  return <UnifiedAuthForm />;
}
