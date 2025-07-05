import { polarClient } from '@polar-sh/better-auth';
import { createAuthClient } from 'better-auth/react';

/* -------------------------------------------------------------------------
   Determine the correct baseURL for Better-Auth REST calls.

   Rules
   • In production: https://www.weblinq.dev
   • In Vercel preview / local dev in the browser:  window.location.origin
   • In unit tests / SSR fallback:  process.env.NEXT_PUBLIC_FRONTEND_URL
--------------------------------------------------------------------------- */

function resolveBaseURL(): string | undefined {
  // Build-time / SSR: no window global
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_FRONTEND_URL;
  }

  // Browser: use current origin so previews work automatically
  return window.location.origin;
}

/* 1. Create the Better-Auth client.  Leaving baseURL `undefined` makes it
      fall back to relative URLs when running in the browser, which is what
      we want in Vercel previews.                                         */
export const authClient = createAuthClient({
  baseURL: resolveBaseURL(),
  fetchOptions: { credentials: 'include' },
  plugins: [polarClient()],
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
