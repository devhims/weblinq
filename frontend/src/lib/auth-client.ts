import { createAuthClient } from 'better-auth/react';
import { polarClient } from '@polar-sh/better-auth';
import { config } from '@/config/env';

/* 1. Create the Better-Auth client with Polar integration.
      Point directly to the backend where Better Auth + Polar is configured.
      No frontend proxy needed - Better Auth handles cross-domain cookies.   */
export const authClient = createAuthClient({
  baseURL: config.backendUrl, // Point directly to backend
  fetchOptions: { credentials: 'include' },
  plugins: [polarClient()], // Adds checkout(), portal(), usage() methods
});

/* 2.  Re-export the hooks & helpers Better Auth injects. */
export const {
  useSession, // live session info inside React components
  signIn,
  signUp,
  signOut,
  getSession,
  $Infer,
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
