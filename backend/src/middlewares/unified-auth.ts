import type { MiddlewareHandler } from 'hono';

import type { AppBindings } from '@/lib/types';

/**
 * Unified authentication middleware following Better Auth documentation pattern
 *
 * Better Auth's getSession() automatically handles:
 * - Session cookies (better-auth.session_token)
 * - API keys via Authorization: Bearer header (when apiKey plugin is enabled)
 *
 * No manual API key extraction needed!
 */
export const unifiedAuth: MiddlewareHandler<AppBindings> = async (c, next) => {
  const auth = c.get('auth');

  // Better Auth handles both cookies AND API keys automatically
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    c.set('user', null);
    c.set('session', null);
    return next();
  }

  c.set('user', session.user);
  c.set('session', session.session);
  return next();
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

  if (!user || !session) {
    return c.json(
      {
        error: 'Authentication required',
        message: 'Valid session or API key required',
      },
      401,
    );
  }

  await next();
};

export default unifiedAuth;
