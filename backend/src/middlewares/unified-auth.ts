import type { MiddlewareHandler } from 'hono';

import type { AppBindings } from '@/lib/types';

/**
 * Unified authentication middleware for cross-domain architecture
 *
 * Better Auth handles cross-domain sessions automatically with proper config.
 * This middleware supports:
 * 1. Cross-domain session cookies (with SameSite=none, partitioned=true)
 * 2. API keys via Authorization: Bearer header (when apiKey plugin is enabled)
 *
 * ✅ Updated: No custom session token handling - Better Auth handles it all!
 */
export const unifiedAuth: MiddlewareHandler<AppBindings> = async (c, next) => {
  const auth = c.get('auth');

  try {
    // ✅ Better Auth handles cross-domain cookies + API keys automatically
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
      query: {
        // Uncomment for debugging cross-domain issues
        // disableCookieCache: true
      },
    });

    if (!session) {
      // Enhanced debug logging for development
      const isDev =
        c.env.NODE_ENV === 'development' || c.env.NODE_ENV === 'preview';

      if (isDev) {
        const cookies = c.req.raw.headers.get('cookie');
        const authorization = c.req.raw.headers.get('authorization');
        const origin = c.req.raw.headers.get('origin');
        const userAgent = c.req.raw.headers.get('user-agent');

        console.log('🔍 No session found - Debug info:', {
          path: c.req.path,
          method: c.req.method,
          origin,
          hasCookies: !!cookies,
          hasAuthorization: !!authorization,
          cookiePreview: cookies?.substring(0, 100),
          authPreview: authorization?.substring(0, 50),
          userAgent: userAgent?.substring(0, 50),
          isSafari:
            userAgent?.includes('Safari') && !userAgent?.includes('Chrome'),
        });
      }

      c.set('user', null);
      c.set('session', null);
      return next();
    }

    c.set('user', session.user);
    c.set('session', session.session);

    // Success logging for development
    const isDev =
      c.env.NODE_ENV === 'development' || c.env.NODE_ENV === 'preview';
    if (isDev) {
      console.log('✅ Session validated successfully:', {
        userId: session.user.id,
        email: session.user.email,
        sessionId: session.session.id,
      });
    }

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
 * - A valid cross-domain session cookie, OR
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
            timestamp: new Date().toISOString(),
          },
        }),
      },
      401,
    );
  }

  await next();
};

export default unifiedAuth;
