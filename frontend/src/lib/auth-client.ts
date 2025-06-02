import { createAuthClient } from 'better-auth/react';

/* Detect where the front-end is running.
   - In production we'll be behind `https://www.weblinq.dev` (fixed: was missing 'www')
   - In dev we fall back to localhost so "vercel dev" just works.           */
const BASE_URL =
  process.env.NEXT_PUBLIC_FRONTEND_URL ?? 'http://localhost:3000';

/* 1.  Create the client.
      `credentials:"include"` is essential; without it the browser drops
      the `ba_session` cookie on every cross-sub-domain fetch.             */
export const authClient = createAuthClient({
  baseURL: BASE_URL, // docs: baseURL is optional but recommended
  fetchOptions: { credentials: 'include' }, // send cookie on every request
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
