import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787',
});

// Export the hooks and methods from Better Auth
export const { useSession, signIn, signUp, signOut, getSession, $Infer } =
  authClient;

// Export types for TypeScript support
export type Session = typeof authClient.$Infer.Session;
export type User = typeof authClient.$Infer.Session.user;
