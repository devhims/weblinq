import { createAuthClient } from 'better-auth/react';
import { getAuthUrl } from '@/config/env';

// Debug: Log the auth URL being used
const authUrl = getAuthUrl();
console.log('🔧 Auth client base URL:', authUrl);
console.log('🔧 Environment variables:', {
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL,
  NEXT_PUBLIC_FRONTEND_URL: process.env.NEXT_PUBLIC_FRONTEND_URL,
});

// Override fetch to debug all requests
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
      ? input.href
      : input.url;

  // Only log auth-related requests
  if (url.includes('/api/auth/')) {
    console.log('🌐 Auth fetch request:', {
      url,
      method: init?.method || 'GET',
      credentials: init?.credentials,
      headers: init?.headers,
    });

    const response = await originalFetch(input, init);
    const clonedResponse = response.clone();

    console.log('🌐 Auth fetch response:', {
      url,
      status: response.status,
      statusText: response.statusText,
      headers: [...response.headers.entries()],
    });

    // Try to log response body for auth requests
    try {
      const text = await clonedResponse.text();
      console.log('🌐 Auth response body:', text.substring(0, 500)); // First 500 chars
    } catch {
      console.log('🌐 Could not read response body');
    }

    return response;
  }

  return originalFetch(input, init);
};

export const authClient = createAuthClient({
  baseURL: authUrl, // Better Auth standard endpoints
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
