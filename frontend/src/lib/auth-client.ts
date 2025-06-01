import { createAuthClient } from 'better-auth/react';

// ✅ CRITICAL: Point to backend auth server for cross-domain setup
const isProduction = process.env.NODE_ENV === 'production';
const backendUrl = isProduction
  ? 'https://weblinq-production.thinktank-himanshu.workers.dev'
  : 'http://localhost:8787';

export const authClient = createAuthClient({
  // ✅ CRITICAL: Point to backend auth server, not current domain
  baseURL: `${backendUrl}/api/auth`,

  // ✅ CRITICAL: Configure for cross-domain authentication
  fetchOptions: {
    credentials: 'include', // Send cross-domain cookies
    mode: 'cors', // Enable CORS
  },

  // ✅ Enhanced session management for cross-domain reliability
  session: {
    // Check session more frequently for cross-domain reliability
    refetchInterval: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: true,
    // Retry session checks if they fail (important for cross-domain)
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
