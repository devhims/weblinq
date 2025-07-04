import type { MiddlewareHandler } from 'hono';

import * as HttpStatusCodes from 'stoker/http-status-codes';

import type { AppBindings } from '@/lib/types';

import { createStandardErrorResponse, ERROR_CODES } from '@/lib/response-utils';

/**
 * Unified authentication middleware for cross-domain architecture
 *
 * This middleware supports multiple authentication methods:
 * 1. Session tokens via Authorization: Bearer header (using bearer plugin)
 * 2. Session cookies (same-domain fallback)
 * 3. API keys via Authorization: Bearer header (when apiKey plugin is enabled)
 *
 * ✅ Updated: Properly use bearer plugin for cross-domain session validation
 */
export const unifiedAuth: MiddlewareHandler<AppBindings> = async (c, next) => {
  const auth = c.get('auth');

  try {
    // Always try to get session - better-auth will handle both cookies and bearer tokens
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (!session) {
      // Enhanced debug logging for development
      const isDev = c.env.NODE_ENV === 'development' || c.env.NODE_ENV === 'preview';

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
          isSafari: userAgent?.includes('Safari') && !userAgent?.includes('Chrome'),
        });
      }

      c.set('user', null);
      c.set('session', null);
      return next();
    }

    c.set('user', session.user);
    c.set('session', session.session);

    // Success logging for development
    const isDev = c.env.NODE_ENV === 'development' || c.env.NODE_ENV === 'preview';
    if (isDev) {
      const authHeader = c.req.raw.headers.get('authorization');
      console.log('✅ Session validated successfully:', {
        userId: session.user.id,
        email: session.user.email,
        sessionId: session.session.id,
        source: authHeader ? 'authorization-header' : 'cookies',
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
    // Use type-safe error response with auto-generated UUID
    const errorResponse = createStandardErrorResponse('Authentication required', ERROR_CODES.AUTHENTICATION_REQUIRED);

    // Add request ID to response headers for easier debugging
    return c.json(errorResponse, HttpStatusCodes.UNAUTHORIZED, {
      'X-Request-ID': errorResponse.error.requestId!,
    });
  }

  await next();
};

export default unifiedAuth;
