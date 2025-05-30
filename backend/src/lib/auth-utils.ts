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
