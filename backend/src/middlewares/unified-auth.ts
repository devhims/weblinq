import type { MiddlewareHandler } from 'hono';

import type { AppBindings } from '@/lib/types';

/**
 * Helper function to validate custom session token from frontend
 */
function validateSessionToken(token: string) {
  try {
    const decoded = atob(token);
    const tokenData = JSON.parse(decoded);

    // Basic validation
    if (!tokenData.userId || !tokenData.email || !tokenData.timestamp) {
      return null;
    }

    // Check if token is not too old (15 minutes)
    const maxAge = 15 * 60 * 1000; // 15 minutes
    if (Date.now() - tokenData.timestamp > maxAge) {
      console.log('Session token expired');
      return null;
    }

    return {
      user: {
        id: tokenData.userId,
        email: tokenData.email,
      },
      session: {
        id: `frontend-${tokenData.userId}`,
        expiresAt: new Date(tokenData.timestamp + maxAge),
      },
    };
  } catch (error) {
    console.error('Invalid session token:', error);
    return null;
  }
}

/**
 * Helper function to normalize cookies for production secure cookie prefixes
 * In production, browsers automatically prefix cookies with __Secure- when served over HTTPS
 */
function normalizeCookiesForProduction(
  cookieHeader: string | undefined,
): string | undefined {
  if (!cookieHeader) {
    return cookieHeader;
  }

  // Create a modified cookie header that includes both standard and secure-prefixed versions
  // This ensures Better Auth can find the session cookie regardless of prefix
  const cookies = cookieHeader.split('; ');
  const normalizedCookies: string[] = [...cookies];

  // Look for secure-prefixed Better Auth session cookies and add standard versions
  for (const cookie of cookies) {
    if (cookie.startsWith('__Secure-better-auth.session_token=')) {
      // Add the standard cookie name version
      const value = cookie.replace('__Secure-better-auth.session_token=', '');
      normalizedCookies.push(`better-auth.session_token=${value}`);
      console.log(
        'Found secure-prefixed session cookie, adding standard version for Better Auth compatibility',
      );
    }
    // Handle any other secure-prefixed Better Auth cookies
    if (cookie.startsWith('__Secure-better-auth.')) {
      const standardName = cookie.replace('__Secure-', '');
      if (
        !cookies.some((c) => c.startsWith(`${standardName.split('=')[0]}=`))
      ) {
        normalizedCookies.push(standardName);
      }
    }
  }

  return normalizedCookies.join('; ');
}

/**
 * Unified authentication middleware that supports both cookie sessions and API keys.
 *
 * This middleware leverages Better Auth's built-in unified session handling:
 * 1. Checks for a valid backend session cookie and API keys with normalized headers
 * 2. Handles secure-prefixed cookies in production (__Secure- prefix)
 * 3. If Better Auth session fails, falls back to custom X-Session-Token validation
 * 4. When an API key is valid, uses Better Auth's session object
 * 5. Returns the same session shape regardless of authentication method
 *
 * CRITICAL: API key operations require Better Auth's real session context, not custom sessions
 *
 * Note: This middleware expects the auth instance to be available in context (set by create-app.ts)
 */
export const unifiedAuth: MiddlewareHandler<AppBindings> = async (c, next) => {
  const auth = c.get('auth');

  try {
    // Get the original cookie header
    const originalCookieHeader = c.req.header('cookie');

    // Normalize cookies to handle secure prefixes in production
    const normalizedCookieHeader =
      normalizeCookiesForProduction(originalCookieHeader);

    // Create a new headers object with normalized cookies
    const normalizedHeaders = new Headers(c.req.raw.headers);
    if (
      normalizedCookieHeader &&
      normalizedCookieHeader !== originalCookieHeader
    ) {
      normalizedHeaders.set('cookie', normalizedCookieHeader);
    }

    // CRITICAL: Always try Better Auth session validation first
    // This ensures API key operations have proper session context
    let session = await auth.api.getSession({
      headers: normalizedHeaders,
    });

    let sessionSource = 'none';

    if (session) {
      sessionSource = 'backend';
      console.log(
        'UnifiedAuth: Using Better Auth session (required for API key operations)',
      );
    } else {
      // Only fall back to custom token validation if Better Auth session completely fails
      // Note: Custom sessions won't work with API key operations
      const sessionToken = c.req.header('X-Session-Token');
      if (sessionToken) {
        console.log(
          'UnifiedAuth: Better Auth session failed, trying custom session token...',
        );
        console.log(
          'WARNING: Custom sessions do not support API key operations',
        );
        session = validateSessionToken(sessionToken);
        sessionSource = session ? 'frontend-token' : 'none';
      }
    }

    console.log('UnifiedAuth debug:', {
      hasAuth: !!auth,
      hasSession: !!session,
      sessionSource,
      hasSessionToken: !!c.req.header('X-Session-Token'),
      originalCookies: originalCookieHeader,
      normalizedCookies: normalizedCookieHeader,
      cookiesModified: normalizedCookieHeader !== originalCookieHeader,
      userAgent: c.req.header('user-agent'),
      origin: c.req.header('origin'),
    });

    if (session) {
      // Authentication successful - could be backend session, frontend token, or API key
      c.set('user', session.user);
      c.set('session', session.session);
      console.log(
        `Auth successful for user: ${session.user.email} (source: ${sessionSource})`,
      );

      // Warn if using custom session for API operations
      if (sessionSource === 'frontend-token') {
        console.log(
          'WARNING: Using custom session - API key operations may fail',
        );
      }
    } else {
      c.set('user', null);
      c.set('session', null);
      console.log('No valid session found from any source');
    }
  } catch (error) {
    console.error('UnifiedAuth error:', error);
    c.set('user', null);
    c.set('session', null);
  }

  await next();
};

/**
 * Require authentication middleware - use after unifiedAuth
 *
 * This middleware ensures that the user is authenticated via either:
 * - A valid backend session cookie, OR
 * - A valid frontend session token (X-Session-Token), OR
 * - A valid API key
 *
 * Usage:
 * ```
 * router.use('*', unifiedAuth);           // Apply to all routes
 * router.use('/protected/*', requireAuth); // Require auth for protected routes
 * ```
 */
export const requireAuth: MiddlewareHandler<AppBindings> = async (c, next) => {
  const user = c.get('user');
  const session = c.get('session');

  console.log('RequireAuth debug:', {
    hasUser: !!user,
    hasSession: !!session,
    userId: user?.id,
    userEmail: user?.email,
  });

  // User must be authenticated (session will be present for backend, frontend, and API key auth)
  if (!user || !session) {
    console.log('Authentication required - rejecting request');
    return c.json(
      {
        error:
          'Authentication required. Please provide a valid session cookie or API key.',
      },
      401,
    );
  }

  console.log('Authentication check passed for user:', user.email);
  await next();
};

export default unifiedAuth;
