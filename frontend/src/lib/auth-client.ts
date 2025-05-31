import { createAuthClient } from 'better-auth/react';
import { config, getAuthUrl } from '@/config/env';

export const authClient = createAuthClient({
  baseURL: getAuthUrl(), // This will proxy through /api
  // Add direct backend option for troubleshooting
  // baseURL: config.auth.baseUrl + '/api/auth', // Uncomment this to bypass proxy entirely
  fetchOptions: {
    credentials: 'include', // Include cookies for session management
  },
});

// Export convenience functions
export const { signIn, signUp, signOut, getSession, useSession } = authClient;

// Direct backend client for server-side or troubleshooting
export const directAuthClient = createAuthClient({
  baseURL: config.auth.baseUrl + '/api/auth', // Direct backend connection
});

// Export the hooks and methods from Better Auth
export const { $Infer } = authClient;

// Export types for TypeScript support
export type Session = typeof authClient.$Infer.Session;
export type User = typeof authClient.$Infer.Session.user;
