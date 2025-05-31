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

// Custom session refresh function that can be called manually
export async function refreshSession() {
  try {
    console.log('Manually refreshing session...');
    const session = await getSession();
    console.log('Session refresh result:', session);
    return session;
  } catch (error) {
    console.error('Session refresh failed:', error);
    throw error;
  }
}

// Export types for TypeScript support
export type Session = typeof authClient.$Infer.Session;
export type User = typeof authClient.$Infer.Session.user;
