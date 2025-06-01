import { createAuthClient } from 'better-auth/react';
import { getAuthUrl } from '@/config/env';

export const authClient = createAuthClient({
  baseURL: getAuthUrl(), // Better Auth standard endpoints
  fetchOptions: {
    credentials: 'include', // Include cookies for session management
  },
});

// Export the hooks and methods from Better Auth
export const { useSession, signIn, signUp, signOut, getSession, $Infer } =
  authClient;

// Export types for TypeScript support
export type Session = typeof authClient.$Infer.Session;
export type User = typeof authClient.$Infer.Session.user;
