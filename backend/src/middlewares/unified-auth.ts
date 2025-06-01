import type { MiddlewareHandler } from 'hono';

import type { AppBindings } from '@/lib/types';

/**
 * Unified authentication middleware for dual auth architecture
 *
 * Handles authentication from multiple sources:
 * 1. Backend session cookies (better-auth.session_token)
 * 2. API keys via Authorization: Bearer header (when apiKey plugin is enabled)
 * 3. Frontend session tokens via X-Session-Token header (from frontend auth)
 *
 * This supports a dual auth setup where:
 * - Frontend auth handles login/OAuth (same domain, no CORS issues)
 * - Backend auth handles API keys and business logic (cross domain)
 */
export const unifiedAuth: MiddlewareHandler<AppBindings> = async (c, next) => {
  const auth = c.get('auth');

  try {
    // First, try standard Better Auth session validation (cookies + API keys)
    let session = await auth.api.getSession({
      headers: c.req.raw.headers,
      query: {
        // disableCookieCache: true // Uncomment for debugging
      },
    });

    // If no standard session, try to validate frontend session token
    if (!session) {
      const frontendSessionToken = c.req.header('x-session-token');

      if (frontendSessionToken) {
        try {
          // Decode the base64 session token from frontend
          const decodedToken = atob(frontendSessionToken);
          const tokenData = JSON.parse(decodedToken);

          console.log('🔍 Frontend session token:', {
            userId: tokenData.userId,
            email: tokenData.email,
            timestamp: tokenData.timestamp,
          });

          // Validate token timestamp (optional - check if not too old)
          const tokenAge = Date.now() - tokenData.timestamp;
          const maxAge = 60 * 60 * 24 * 7 * 1000; // 7 days in milliseconds

          if (tokenAge > maxAge) {
            console.warn('⚠️ Frontend session token expired');
          } else {
            // Create a mock session object for the backend
            // You might want to validate this against your database
            session = {
              user: {
                id: tokenData.userId,
                name: tokenData.email.split('@')[0], // Use email prefix as name
                email: tokenData.email,
                emailVerified: false, // Assume not verified from frontend token
                createdAt: new Date(tokenData.timestamp),
                updatedAt: new Date(),
                image: null,
              },
              session: {
                id: `frontend-${tokenData.userId}`,
                createdAt: new Date(tokenData.timestamp),
                updatedAt: new Date(),
                userId: tokenData.userId,
                expiresAt: new Date(tokenData.timestamp + maxAge),
                token: frontendSessionToken,
                ipAddress: null,
                userAgent: null,
              },
            };

            console.log(
              '✅ Frontend session validated for user:',
              tokenData.email,
            );
          }
        } catch (error) {
          console.error('❌ Failed to decode frontend session token:', error);
        }
      }
    }

    if (!session) {
      // Log for debugging in development
      const isDev =
        c.env.NODE_ENV === 'development' || c.env.NODE_ENV === 'preview';
      if (isDev) {
        const cookies = c.req.raw.headers.get('cookie');
        const authorization = c.req.raw.headers.get('authorization');
        const sessionToken = c.req.raw.headers.get('x-session-token');
        console.log('🔍 No session found:', {
          hasCookies: !!cookies,
          hasAuthorization: !!authorization,
          hasSessionToken: !!sessionToken,
          cookiePreview: cookies?.substring(0, 100),
          authPreview: authorization?.substring(0, 50),
          tokenPreview: sessionToken?.substring(0, 50),
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
