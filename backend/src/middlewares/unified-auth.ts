import type { MiddlewareHandler } from 'hono';

import type { AppBindings } from '@/lib/types';

/**
 * Unified authentication middleware that:
 * 1. Handles secure cookie prefixes in production
 * 2. Uses standard Better Auth session validation only
 * 3. No custom session fallbacks
 */
export const unifiedAuth: MiddlewareHandler<AppBindings> = async (c, next) => {
  const auth = c.get('auth');

  console.log('🔒 Starting unified auth middleware');

  // Debug: Log all cookies to understand what we're receiving
  const cookieHeader = c.req.header('cookie');
  console.log('📝 Raw cookie header:', cookieHeader);

  // Extract all cookies
  const cookies: Record<string, string> = {};
  if (cookieHeader) {
    cookieHeader.split(';').forEach((cookie) => {
      const [key, ...valueParts] = cookie.trim().split('=');
      if (key && valueParts.length > 0) {
        cookies[key] = valueParts.join('=');
      }
    });
  }

  console.log('📝 Parsed cookies:', Object.keys(cookies));

  // If we have a secure-prefixed session cookie, normalize it for Better Auth
  const secureSessionKey = '__Secure-better-auth.session_token';
  const standardSessionKey = 'better-auth.session_token';

  if (cookies[secureSessionKey] && !cookies[standardSessionKey]) {
    console.log('🔄 Found secure-prefixed session cookie, normalizing...');

    const normalizedCookieEntries = Object.entries(cookies);
    normalizedCookieEntries.push([
      standardSessionKey,
      cookies[secureSessionKey],
    ]);

    // Create normalized cookie header
    const normalizedCookieHeader = normalizedCookieEntries
      .map(([key, value]) => `${key}=${value}`)
      .join('; ');

    // Create new request with normalized cookies for Better Auth
    const newHeaders = new Headers(c.req.raw.headers);
    newHeaders.set('cookie', normalizedCookieHeader);

    console.log(
      '🔄 Normalized cookie header for Better Auth:',
      normalizedCookieHeader,
    );

    // Create new request with normalized headers
    const newRequest = new Request(c.req.raw.url, {
      method: c.req.raw.method,
      headers: newHeaders,
      body: c.req.raw.body,
    });

    // Override the request in context for Better Auth
    Object.defineProperty(c.req, 'raw', {
      value: newRequest,
      writable: true,
    });
  }

  // Now use standard Better Auth session validation
  try {
    console.log('🔍 Attempting Better Auth session validation...');

    const session = await auth.api.getSession({
      headers: c.req.header(),
    });

    if (session) {
      console.log('✅ Better Auth session found:', {
        userId: session.user?.id,
        email: session.user?.email,
        sessionId: session.session?.id,
      });

      c.set('user', session.user);
      c.set('session', session.session);

      await next();
      return;
    }

    console.log('❌ No Better Auth session found');
  } catch (error) {
    console.log('❌ Better Auth session validation failed:', error);
  }

  // Check for API key in Authorization header
  const authHeader = c.req.header('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    try {
      console.log('🔑 Attempting API key validation...');

      // Create headers object for API key validation
      const apiHeaders = new Headers(c.req.raw.headers);
      apiHeaders.set('authorization', authHeader);

      // Use the session endpoint with API key authentication
      const result = await auth.api.getSession({
        headers: apiHeaders,
      });

      if (result) {
        console.log('✅ Valid API key found');
        c.set('user', result.user);
        c.set('session', result.session);
        await next();
        return;
      }

      console.log('❌ Invalid API key');
    } catch (error) {
      console.log('❌ API key validation failed:', error);
    }
  }

  // No valid authentication found
  console.log('❌ Authentication failed - no valid session or API key');

  return c.json(
    {
      error: 'Authentication required',
      message: 'Valid session or API key required',
    },
    401,
  );
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
