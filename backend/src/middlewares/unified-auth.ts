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

  try {
    // Better Auth handles both cookies AND API keys automatically
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
      // Disable cookie cache for debugging in production if needed
      query: {
        // disableCookieCache: true
      },
    });

    if (!session) {
      // Log for debugging in development
      const isDev =
        c.env.NODE_ENV === 'development' || c.env.NODE_ENV === 'preview';
      if (isDev) {
        const cookies = c.req.raw.headers.get('cookie');
        const authorization = c.req.raw.headers.get('authorization');
        console.log('🔍 No session found:', {
          hasCookies: !!cookies,
          hasAuthorization: !!authorization,
          cookiePreview: cookies?.substring(0, 100),
          authPreview: authorization?.substring(0, 50),
        });
      }

      c.set('user', null);
      c.set('session', null);
      return next();
    }

    c.set('user', session.user);
    c.set('session', session.session);
    return next();
  } catch (error) {
    // Log auth errors for debugging
    console.error('❌ Auth middleware error:', error);
    c.set('user', null);
    c.set('session', null);
    return next();
  }
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
    // Enhanced error response for debugging
    const isDev =
      c.env.NODE_ENV === 'development' || c.env.NODE_ENV === 'preview';
    return c.json(
      {
        error: 'Authentication required',
        message: 'Valid session or API key required',
        ...(isDev && {
          debug: {
            hasUser: !!user,
            hasSession: !!session,
            path: c.req.path,
            method: c.req.method,
          },
        }),
      },
      401,
    );
  }

  await next();
};

export default unifiedAuth;
