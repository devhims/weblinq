import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  // NO baseURL needed - defaults to current domain's /api/auth/* routes
  // This handles email login & OAuth authentication on the SAME domain

  // ✅ Enhanced session management for Safari/incognito compatibility
  fetchOptions: {
    credentials: 'include', // Ensure cookies are included
  },

  // ✅ Session configuration for better reliability
  session: {
    // Check session more frequently for Safari/incognito reliability
    refetchInterval: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: true,
    // Retry session checks if they fail
    retry: 3,
    retryDelay: 1000, // 1 second between retries
  },
});

// Export the hooks and methods from Better Auth
export const { useSession, signIn, signUp, signOut, getSession, $Infer } =
  authClient;

// Export types for TypeScript support
export type Session = typeof authClient.$Infer.Session;
export type User = typeof authClient.$Infer.Session.user;
