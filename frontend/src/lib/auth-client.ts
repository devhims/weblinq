import { createAuthClient } from 'better-auth/react';
import { polarClient } from '@polar-sh/better-auth';
import { config } from '@/config/env';
import { shouldUseFrontendAuth } from '@/lib/utils';
import { adminClient } from 'better-auth/client/plugins';

/* ------------------------------------------------------------------ */
/*  Hybrid Auth Client - Routes to Frontend or Backend Based on Env   */
/* ------------------------------------------------------------------ */

// For preview environments, use frontend auth (same domain cookies work)
// For production, use backend auth (cross-domain cookies work)
const baseURL = shouldUseFrontendAuth()
  ? config.frontendUrl
  : config.backendUrl;

console.log('🔧 Auth client configuration:', {
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
  shouldUseFrontendAuth: shouldUseFrontendAuth(),
  baseURL,
});

export const authClient = createAuthClient({
  baseURL, // Dynamic based on environment
  fetchOptions: { credentials: 'include' },
  plugins: shouldUseFrontendAuth()
    ? [adminClient()] // Add admin client for frontend auth (preview)
    : [polarClient(), adminClient()], // Add both Polar and admin for backend auth (production)
});

/* 2.  Re-export the hooks & helpers Better Auth injects. */
export const {
  useSession, // live session info inside React components
  signIn,
  signUp,
  signOut,
  getSession,
  $Infer,
  // Admin functions
  admin,
} = authClient;

/* 3.  Handy TypeScript aliases. */
export type Session = typeof authClient.$Infer.Session;
export type User = (typeof authClient.$Infer.Session)['user'];

/* 4.  Optional utility: bypass the cookie cache.
      Better Auth caches a fresh session in a short-lived cookie to spare
      network calls; disabling that cache forces a round-trip when you
      suspect the cookie is stale.                                          */
export async function refreshSession() {
  try {
    return await getSession({ query: { disableCookieCache: true } });
  } catch {
    /* swallow – treat "no session" the same as "expired session"          */
    return null;
  }
}
