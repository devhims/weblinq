import type { MiddlewareHandler } from 'hono';

import { requireAuth } from '@/middlewares';

import type { AppBindings } from './types';

import { createRouter } from './create-app';

/**
 * Helper function to create protected routes that require authentication
 */
export function createProtectedRouter() {
  const router = createRouter();

  // Apply auth requirement to all routes in this router
  router.use('*', requireAuth);

  return router;
}

/**
 * Middleware to optionally require auth (can be used for routes that work with or without auth)
 */
export const optionalAuth: MiddlewareHandler<AppBindings> = async (c, next) => {
  // Session is already populated by unifiedAuth middleware
  // This middleware just passes through - useful for routes that can work with or without auth
  return next();
};

/**
 * Helper to check if user is authenticated (either via session or API token)
 */
export function isAuthenticated(c: any): boolean {
  const user = c.get('user');
  const session = c.get('session');
  const apiToken = c.get('apiToken');

  // User is authenticated if they have a user object (from either session or API key)
  return !!(user && (session || apiToken));
}

/**
 * Helper to check if user is authenticated via session (browser-based)
 */
export function isSessionAuthenticated(c: any): boolean {
  const user = c.get('user');
  const session = c.get('session');
  return !!(user && session);
}

/**
 * Helper to check if user is authenticated via API token (server-to-server)
 */
export function isApiTokenAuthenticated(c: any): boolean {
  const user = c.get('user');
  const apiToken = c.get('apiToken');
  return !!(user && apiToken);
}

/**
 * Helper to get current user safely
 */
export function getCurrentUser(c: any) {
  return c.get('user');
}

/**
 * Helper to get current session safely
 */
export function getCurrentSession(c: any) {
  return c.get('session');
}

/**
 * Helper to get current API token safely
 */
export function getCurrentApiToken(c: any) {
  return c.get('apiToken');
}

/**
 * Helper to get authentication type
 */
export function getAuthType(c: any): 'session' | 'api-token' | 'none' {
  const user = c.get('user');
  const session = c.get('session');
  const apiToken = c.get('apiToken');

  if (!user) {
    return 'none';
  }
  if (session) {
    return 'session';
  }
  if (apiToken) {
    return 'api-token';
  }
  return 'none';
}

// ----------------------------------------------------------------
// Origin Validation for CORS and Auth
// ----------------------------------------------------------------

export function isValidOrigin(origin: string, env: CloudflareBindings): boolean {
  const isLocal = env.BETTER_AUTH_URL?.startsWith('http://localhost');

  if (isLocal) {
    // In development, allow localhost variants
    const allowed = ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:8787'].includes(origin);
    if (!allowed) {
      console.log(`🔒 [DEV] Origin rejected: ${origin}`);
    }
    return allowed;
  }

  // Production allowed origins
  const productionOrigins = ['https://weblinq.dev', 'https://www.weblinq.dev'];

  // Check if it's a production origin
  if (productionOrigins.includes(origin)) {
    console.log(`✅ [PROD] Origin accepted (production): ${origin}`);
    return true;
  }

  // Check if it's a Vercel preview URL
  const isPreview = isValidVercelPreview(origin, env);
  if (isPreview) {
    console.log(`✅ [PREVIEW] Origin accepted (Vercel preview): ${origin}`);
  } else {
    console.log(`🔒 [REJECT] Origin rejected: ${origin}`);
  }

  return isPreview;
}

/**
 * Validates Vercel preview URLs for your project
 * Security layers:
 * 1. HTTPS enforcement
 * 2. Domain restriction (configurable via env)
 * 3. Pattern matching
 * 4. Account validation
 */
function isValidVercelPreview(origin: string, env: CloudflareBindings): boolean {
  try {
    const url = new URL(origin);

    // Layer 1: Must be HTTPS for security
    if (url.protocol !== 'https:') {
      console.log(`🔒 Preview rejected (not HTTPS): ${origin}`);
      return false;
    }

    const hostname = url.hostname;

    // Layer 2: Configurable Vercel account restriction (security boundary)
    const allowedVercelAccount = env.VERCEL_ACCOUNT_DOMAIN;
    if (!hostname.endsWith(allowedVercelAccount)) {
      console.log(`🔒 Preview rejected (wrong account, expected: ${allowedVercelAccount}): ${hostname}`);
      return false;
    }

    // Layer 3: Pattern matching (business logic)
    const vercelPatterns = getVercelPatterns(allowedVercelAccount);
    const matches = vercelPatterns.some((pattern) => pattern.test(hostname));

    if (!matches) {
      console.log(`🔒 Preview rejected (pattern mismatch): ${hostname}`);
    }

    return matches;
  } catch (error) {
    console.log(`🔒 Preview rejected (invalid URL): ${origin}`, error);
    return false;
  }
}

/**
 * Get Vercel preview patterns for the specified account domain
 * These are validation rules, not secrets - kept in code for:
 * - Version control and review
 * - Testing and validation
 * - Clear documentation
 */
function getVercelPatterns(accountDomain: string): RegExp[] {
  // Extract the base pattern from account domain
  const escapedDomain = accountDomain.replace(/\./g, '\\.');

  return [
    // Pattern 1: weblinq-git-{branch-name}-{account}.vercel.app
    new RegExp(`^weblinq-git-[a-zA-Z0-9-]+-${escapedDomain}$`),
    // Pattern 2: weblinq-{hash}-{account}.vercel.app
    new RegExp(`^weblinq-[a-zA-Z0-9]+(-[a-zA-Z0-9]+)*-${escapedDomain}$`),
    // Pattern 3: weblinq-{deployment-id}-{account}.vercel.app
    new RegExp(`^weblinq-[a-zA-Z0-9]+-${escapedDomain}$`),
  ];
}

export function getTrustedOrigins(env: CloudflareBindings): string[] {
  const isLocal = env.BETTER_AUTH_URL?.startsWith('http://localhost');

  if (isLocal) {
    return ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:8787'];
  }

  // Include production origins
  const origins = ['https://weblinq.dev', 'https://www.weblinq.dev'];

  // Add Vercel preview support using wildcard patterns
  // Use the known Vercel account domain for this project
  const vercelAccountDomain = env.VERCEL_ACCOUNT_DOMAIN;
  origins.push(`https://*.${vercelAccountDomain}`);

  return origins;
}
