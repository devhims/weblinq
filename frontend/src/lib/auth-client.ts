import { createAuthClient } from 'better-auth/react';
import { getAuthUrl } from '@/config/env';

export const authClient = createAuthClient({
  baseURL: getAuthUrl(), // Better Auth standard endpoints
  fetchOptions: {
    credentials: 'include', // Include cookies for session management
  },
  // Add retry logic for session detection after OAuth
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60 * 1000, // 5 minutes
    },
    freshTokenOnFocus: true, // Refresh session when window gets focus
    freshTokenOnWindowFocus: true,
  },
});

// Export the hooks and methods from Better Auth
export const { useSession, signIn, signUp, signOut, getSession, $Infer } =
  authClient;

// Export types for TypeScript support
export type Session = typeof authClient.$Infer.Session;
export type User = typeof authClient.$Infer.Session.user;
