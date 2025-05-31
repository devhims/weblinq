import type { MiddlewareHandler } from 'hono';

import type { AppBindings } from '@/lib/types';

/**
 * Unified authentication middleware that supports both cookie sessions and API keys.
 *
 * This middleware leverages Better Auth's built-in unified session handling:
 * 1. Checks for a valid session cookie and API keys
 * 2. When an API key is valid, creates a mock session object linked to the key's owner
 * 4. Returns the same session shape regardless of authentication method
 *
 * This means ONE middleware can protect routes from both browser users (cookies)
 * and machine clients (API keys) seamlessly.
 *
 * Note: This middleware expects the auth instance to be available in context (set by create-app.ts)
 */

export const unifiedAuth: MiddlewareHandler<AppBindings> = async (c, next) => {
  const auth = c.get('auth');

  // Better Auth automatically checks:
  // 1. Session cookies first
  // 2. Then Authorization: Bearer header (if customAPIKeyGetter is configured)
  // 3. When an API key is valid, creates a mock session linked to the key's owner
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (session) {
    // Authentication successful - could be either cookie or API key
    c.set('user', session.user);
    c.set('session', session.session);
  } else {
    c.set('user', null);
    c.set('session', null);
  }

  await next();
};

/**
 * Require authentication middleware - use after unifiedAuth
 *
 * This middleware ensures that the user is authenticated via either:
 * - A valid session cookie, OR
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

  // User must be authenticated (session will be present for both cookie and API key auth)
  if (!user || !session) {
    return c.json(
      {
        error:
          'Authentication required. Please provide a valid session cookie or API key.',
      },
      401,
    );
  }

  await next();
};

export default unifiedAuth;
