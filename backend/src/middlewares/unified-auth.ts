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
  }
  catch (error) {
    console.error('Invalid session token:', error);
    return null;
  }
}

/**
 * Unified authentication middleware that supports both cookie sessions and API keys.
 *
 * This middleware leverages Better Auth's built-in unified session handling:
 * 1. Checks for a valid backend session cookie and API keys
 * 2. If no backend session, tries to validate custom X-Session-Token header from frontend
 * 3. When an API key is valid, creates a mock session object linked to the key's owner
 * 4. Returns the same session shape regardless of authentication method
 *
 * This means ONE middleware can protect routes from both browser users (cookies)
 * and machine clients (API keys) seamlessly.
 *
 * Note: This middleware expects the auth instance to be available in context (set by create-app.ts)
 */
export const unifiedAuth: MiddlewareHandler<AppBindings> = async (c, next) => {
  const auth = c.get('auth');

  try {
    // First, try backend session validation (for API keys and backend sessions)
    let session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    let sessionSource = 'none';

    // If no backend session, try to validate custom session token from frontend
    if (!session) {
      const sessionToken = c.req.header('X-Session-Token');
      if (sessionToken) {
        console.log('Trying custom session token validation...');
        session = validateSessionToken(sessionToken);
        sessionSource = session ? 'frontend-token' : 'none';
      }
    }
    else {
      sessionSource = 'backend';
    }

    console.log('UnifiedAuth debug:', {
      hasAuth: !!auth,
      hasSession: !!session,
      sessionSource,
      hasSessionToken: !!c.req.header('X-Session-Token'),
      cookies: c.req.header('cookie'),
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
    }
    else {
      c.set('user', null);
      c.set('session', null);
      console.log('No valid session found from any source');
    }
  }
  catch (error) {
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
